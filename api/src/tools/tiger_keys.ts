import { ToolContext, ToolResult } from "./ToolContext.js";
// Tiger Claw — tiger_keys Tool
// Primary + Backup key management.
//
// Two layers:
//   Primary (Layer 2) — Tenant's main key. No Tiger Claw message limit.
//   Backup  (Layer 3) — Tenant's backup key. 20 messages/day limit.
//
// If Backup exhausts → bot pauses. Tenant restores a key to resume.
//
// Error classification:
//   401 → rotate immediately
//   402 → rotate + notify tenant
//   403 → rotate + notify tenant
//   429 → wait Retry-After, do NOT rotate
//   5xx → retry 3x with exponential backoff + ±10% jitter, then rotate
//   Timeout → retry 2x, then rotate
//   Degraded → log warning, do NOT rotate
//
// All rotations, recoveries, and limit warnings logged in key_state.json.

import * as https from "https";
import * as http from "http";
import { getTenant, getBotState, setBotState } from "../services/db.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LAYER_LIMITS = {
  3: { dailyMessages: 20 }, // Backup key daily cap
} as const;

// Retry policy per error type
const RETRY_POLICY = {
  "5xx": { maxRetries: 3 },
  timeout: { maxRetries: 2 },
} as const;

// Exponential backoff: 1s → 2s → 4s → 8s → max 60s
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 60000;
const BACKOFF_JITTER = 0.1; // ±10%

// Max events kept in state file
const MAX_EVENTS = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LayerNumber = 2 | 3;

type ApiErrorType =
  | "invalid_key"    // 401
  | "billing"        // 402
  | "forbidden"      // 403
  | "rate_limited"   // 429
  | "server_error"   // 5xx
  | "timeout"        // 30s no response
  | "degraded";      // slow but working

type RotationDecision =
  | "rotate"         // Switch to next layer now
  | "retry"          // Retry after backoff delay
  | "wait"           // Respect Retry-After, don't rotate
  | "log_warning"    // Log only, keep current layer
  | "no_action";     // Already paused or no action needed

type KeyEventType =
  | "rotation"
  | "recovery"
  | "limit_warning"
  | "limit_exceeded"
  | "pause"
  | "error"
  | "retry_recommended";

interface KeyEvent {
  type: KeyEventType;
  timestamp: string;
  fromLayer?: LayerNumber;
  toLayer?: LayerNumber;
  httpStatus?: number;
  errorType?: ApiErrorType;
  retryAttempt?: number;
  retryDelayMs?: number;
  message: string;
}

interface RetryTracker {
  errorType: "5xx" | "timeout";
  attempts: number;
  lastAttemptAt: string;
}

interface KeyState {
  activeLayer: LayerNumber;

  // Backup key (Layer 3) daily limit tracking
  layer3MessageCountToday: number;
  layer3CountDate: string; // YYYY-MM-DD

  // Retry state (cleared on successful call or rotation)
  currentRetry?: RetryTracker;

  // Tenant paused
  tenantPaused: boolean;
  tenantPausedAt?: string;

  // Persisted tenant key values (written by restore_key)
  layer2Key?: string; // Tenant primary key
  layer3Key?: string; // Tenant backup key

  // SecretRef reload tracking
  secretsReloadedAt?: string;

  // Event log (last MAX_EVENTS)
  events: KeyEvent[];

  lastUpdated: string;
}

// Tool parameter types
interface ReportErrorParams {
  action: "report_error";
  httpStatus: number;
  retryAfterSeconds?: number;
  isTimeout?: boolean;
}

interface RestoreKeyParams {
  action: "restore_key";
  layer: LayerNumber;
  apiKey: string;
}

interface RecordMessageParams {
  action: "record_message";
}

interface RotateParams {
  action: "rotate";
  reason?: string;
}

interface StatusParams {
  action: "status";
}

type KeysParams =
  | ReportErrorParams
  | RestoreKeyParams
  | RecordMessageParams
  | RotateParams
  | StatusParams;

// ---------------------------------------------------------------------------
// State persistence
// ---------------------------------------------------------------------------

function defaultState(): KeyState {
  return {
    activeLayer: 2,
    layer3MessageCountToday: 0,
    layer3CountDate: "",
    tenantPaused: false,
    events: [],
    lastUpdated: new Date().toISOString(),
  };
}

async function loadKeyState(workdir: string): Promise<KeyState> {
  const data = await getBotState(workdir, "key_state.json") as Partial<KeyState> | null;
  const def = defaultState();
  if (!data) return def;
  
  return {
    ...def,
    ...data,
    events: data.events ?? def.events,
  };
}

async function saveKeyState(workdir: string, state: KeyState): Promise<void> {
  state.lastUpdated = new Date().toISOString();
  if (state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(-MAX_EVENTS);
  }
  await setBotState(workdir, "key_state.json", state);
}

function appendEvent(state: KeyState, event: KeyEvent): void {
  if (!state.events) {
    state.events = [];
  }
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) {
    state.events = state.events.slice(-MAX_EVENTS);
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

function classifyError(
  httpStatus: number | undefined,
  isTimeout: boolean
): ApiErrorType {
  if (isTimeout) return "timeout";
  if (!httpStatus) return "timeout";
  if (httpStatus === 401) return "invalid_key";
  if (httpStatus === 402) return "billing";
  if (httpStatus === 403) return "forbidden";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus >= 500 && httpStatus < 600) return "server_error";
  return "degraded";
}

function decideAction(
  errorType: ApiErrorType,
  currentRetry: RetryTracker | undefined,
  state: KeyState
): RotationDecision {
  if (state.tenantPaused) return "no_action";

  switch (errorType) {
    case "invalid_key":
    case "billing":
    case "forbidden":
      return "rotate";

    case "rate_limited":
      return "wait";

    case "server_error": {
      const maxRetries = RETRY_POLICY["5xx"].maxRetries;
      const attempts = currentRetry?.errorType === "5xx" ? currentRetry.attempts : 0;
      if (attempts < maxRetries) return "retry";
      return "rotate";
    }

    case "timeout": {
      const maxRetries = RETRY_POLICY["timeout"].maxRetries;
      const attempts = currentRetry?.errorType === "timeout" ? currentRetry.attempts : 0;
      if (attempts < maxRetries) return "retry";
      return "rotate";
    }

    case "degraded":
      return "log_warning";
  }
}

// ---------------------------------------------------------------------------
// Backoff calculation with ±10% jitter
// ---------------------------------------------------------------------------

function backoffMs(attempt: number): number {
  const base = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
  const jitterRange = base * BACKOFF_JITTER;
  const jitter = (Math.random() * 2 - 1) * jitterRange;
  return Math.round(base + jitter);
}

// ---------------------------------------------------------------------------
// Layer helpers
// ---------------------------------------------------------------------------

function nextLayer(current: LayerNumber): LayerNumber | null {
  return current === 2 ? 3 : null; // Primary → Backup → Pause
}

function layerName(layer: LayerNumber): string {
  return layer === 2 ? "Primary Key" : "Backup Key";
}

// ---------------------------------------------------------------------------
// Admin alert via Tiger Claw API
// ---------------------------------------------------------------------------

function notifyAdmin(tenantId: string, message: string): void {
  const apiUrl = process.env.INTERNAL_API_URL ?? (() => { throw new Error("[FATAL] INTERNAL_API_URL environment variable is required"); })();

  try {
    const url = new URL(`/admin/alerts`, apiUrl);
    const isHttps = url.protocol === "https:";
    const lib = isHttps ? https : http;
    const body = JSON.stringify({ tenantId, message, severity: "high" });

    const adminToken = process.env["ADMIN_TOKEN"] ?? "";
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          ...(adminToken ? { "authorization": `Bearer ${adminToken}` } : {}),
        },
      },
      () => { /* fire and forget */ }
    );
    req.on("error", (err) => { console.error(`[tiger_keys] notifyAdmin failed for tenant ${tenantId}:`, err.message); });
    req.setTimeout(10000, () => req.destroy());
    req.write(body);
    req.end();
  } catch {
    // Non-fatal — admin alert failure must not crash the tool
  }
}

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

function detectProvider(key: string): "google" | "openai" | "anthropic" | "grok" | "openrouter" | "kimi" | "unknown" {
  if (key.startsWith("AIza"))    return "google";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("xai-"))    return "grok";
  if (key.startsWith("sk-or-"))  return "openrouter";
  if (key.startsWith("sk-"))     return "openai";
  if (key.startsWith("km-"))     return "kimi";
  return "unknown";
}

async function validateApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  const provider = detectProvider(key);

  if (provider === "unknown") {
    return { valid: false, error: "Unrecognized key format. Check your provider's API key format and try again." };
  }

  // Google: make a live validation call
  if (provider === "google") {
    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: "generativelanguage.googleapis.com",
          path: `/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`,
          method: "GET",
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode === 200) {
              resolve({ valid: true });
            } else if (res.statusCode === 400 || res.statusCode === 403) {
              resolve({ valid: false, error: "That key is not valid." });
            } else {
              resolve({ valid: false, error: `Validation returned status ${res.statusCode}. Please try again.` });
            }
          });
        }
      );
      req.on("error", (err) => resolve({ valid: false, error: `Network error: ${err.message}` }));
      req.setTimeout(15000, () => { req.destroy(); resolve({ valid: false, error: "Validation timed out." }); });
      req.end();
    });
  }

  // All other providers: format is valid — live validation happens at call time
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Rotation — perform a layer switch
// ---------------------------------------------------------------------------

async function performRotation(
  state: KeyState,
  fromLayer: LayerNumber,
  reason: string,
  workdir: string,
  tenantId: string,
  logger: ToolContext["logger"]
): Promise<{ toLayer: LayerNumber | null; tenantMessage: string; adminAlert: boolean }> {
  const toLayer = nextLayer(fromLayer);

  if (toLayer === null) {
    // Backup exhausted → Pause
    state.tenantPaused = true;
    state.tenantPausedAt = new Date().toISOString();

    appendEvent(state, {
      type: "pause",
      timestamp: new Date().toISOString(),
      fromLayer,
      message: `Tenant auto-paused. ${reason}`,
    });

    await saveKeyState(workdir, state);
    notifyAdmin(tenantId, `🔴 Tenant ${tenantId} auto-paused — both keys exhausted. Reason: ${reason}`);

    return {
      toLayer: null,
      tenantMessage: [
        `⚠️ Your bot has been paused.`,
        ``,
        `Both your Primary and Backup keys failed.`,
        ``,
        `To resume: message me "restore key [your-new-key]" with a working key.`,
        `Your leads, sequences, and data are all preserved.`,
      ].join("\n"),
      adminAlert: true,
    };
  }

  // Skip Backup if no key configured → go straight to pause
  if (toLayer === 3 && !state.layer3Key) {
    return performRotation(state, 3, `No Backup key configured — ${reason}`, workdir, tenantId, logger);
  }

  // Normal rotation: Primary → Backup
  state.activeLayer = toLayer;
  state.currentRetry = undefined;

  appendEvent(state, {
    type: "rotation",
    timestamp: new Date().toISOString(),
    fromLayer,
    toLayer,
    message: reason,
  });

  await saveKeyState(workdir, state);

  notifyAdmin(
    tenantId,
    `🟡 WARNING Tenant ${tenantId} rotated to ${layerName(toLayer)}. Reason: ${reason}`
  );

  const tenantMessage = [
    `Your primary API key stopped working. I've switched to your backup key.`,
    ``,
    `You can keep using me, but your backup key has a limit of ${LAYER_LIMITS[3].dailyMessages} messages per day.`,
    ``,
    `To fix this: restore your primary API key and message me "restore key [your-new-key]".`,
  ].join("\n");

  return { toLayer, tenantMessage, adminAlert: true };
}

// ---------------------------------------------------------------------------
// Action: report_error
// ---------------------------------------------------------------------------

async function handleReportError(
  params: ReportErrorParams,
  state: KeyState,
  workdir: string,
  tenantId: string,
  logger: ToolContext["logger"]
): Promise<ToolResult> {
  if (state.tenantPaused) {
    return {
      ok: true,
      output: "Bot is currently paused. Restore API keys to resume.",
      data: { decision: "no_action", tenantPaused: true },
    };
  }

  const errorType = classifyError(params.httpStatus, params.isTimeout ?? false);
  const decision = decideAction(errorType, state.currentRetry, state);

  logger.info("tiger_keys: error reported", {
    httpStatus: params.httpStatus,
    errorType,
    decision,
    activeLayer: state.activeLayer,
  });

  appendEvent(state, {
    type: "error",
    timestamp: new Date().toISOString(),
    httpStatus: params.httpStatus,
    errorType,
    message: `HTTP ${params.httpStatus ?? "timeout"} on ${layerName(state.activeLayer)} — decision: ${decision}`,
  });

  switch (decision) {
    case "rotate": {
      const result = await performRotation(
        state,
        state.activeLayer,
        `HTTP ${params.httpStatus ?? "timeout"} — ${errorType}`,
        workdir,
        tenantId,
        logger
      );

      return {
        ok: true,
        output: result.tenantMessage,
        data: {
          decision: "rotate",
          fromLayer: state.activeLayer,
          toLayer: result.toLayer,
          errorType,
          tenantPaused: state.tenantPaused,
          adminAlerted: result.adminAlert,
        },
      };
    }

    case "retry": {
      const retryErrorType = errorType === "server_error" ? "5xx" : "timeout";
      const currentAttempts = state.currentRetry?.errorType === retryErrorType
        ? state.currentRetry.attempts
        : 0;
      const nextAttempt = currentAttempts + 1;
      const delay = backoffMs(currentAttempts);

      state.currentRetry = {
        errorType: retryErrorType,
        attempts: nextAttempt,
        lastAttemptAt: new Date().toISOString(),
      };

      appendEvent(state, {
        type: "retry_recommended",
        timestamp: new Date().toISOString(),
        retryAttempt: nextAttempt,
        retryDelayMs: delay,
        errorType,
        message: `Retry ${nextAttempt} recommended after ${delay}ms`,
      });

      await saveKeyState(workdir, state);

      return {
        ok: true,
        output: `Provider error (${params.httpStatus ?? "timeout"}). Retrying in ${delay}ms (attempt ${nextAttempt}).`,
        data: {
          decision: "retry",
          retryAttempt: nextAttempt,
          retryDelayMs: delay,
          errorType,
        },
      };
    }

    case "wait": {
      const waitSeconds = params.retryAfterSeconds ?? 60;
      await saveKeyState(workdir, state);

      return {
        ok: true,
        output: `Rate limited (429). Waiting ${waitSeconds}s before retrying. Key is fine — do NOT rotate.`,
        data: {
          decision: "wait",
          retryAfterSeconds: waitSeconds,
          errorType: "rate_limited",
        },
      };
    }

    case "log_warning": {
      await saveKeyState(workdir, state);
      logger.warn("tiger_keys: degraded performance on current layer", {
        layer: state.activeLayer,
      });

      return {
        ok: true,
        output: `API is responding slowly but not failing. Staying on current key. Logged for monitoring.`,
        data: { decision: "log_warning", errorType: "degraded" },
      };
    }

    default:
      await saveKeyState(workdir, state);
      return { ok: true, output: "No action needed.", data: { decision: "no_action" } };
  }
}

// ---------------------------------------------------------------------------
// Action: restore_key
// ---------------------------------------------------------------------------

async function handleRestoreKey(
  params: RestoreKeyParams,
  state: KeyState,
  workdir: string,
  logger: ToolContext["logger"]
): Promise<ToolResult> {
  const restoredLayer = Number(params.layer) as LayerNumber;
  if (![2, 3].includes(restoredLayer)) {
    return { ok: false, error: "Only Layer 2 (Primary) or Layer 3 (Backup) can be restored by the tenant." };
  }

  logger.info("tiger_keys: validating restored key", { layer: restoredLayer });

  const validation = await validateApiKey(params.apiKey);
  if (!validation.valid) {
    return {
      ok: false,
      error: `Key validation failed: ${validation.error} Please check the key and try again.`,
    };
  }

  const previousLayer = state.activeLayer;

  if (restoredLayer === 2) state.layer2Key = params.apiKey;
  if (restoredLayer === 3) state.layer3Key = params.apiKey;

  const shouldSwitch =
    !state.tenantPaused
      ? restoredLayer < state.activeLayer
      : true; // Any valid key resumes from pause

  if (shouldSwitch) {
    state.activeLayer = restoredLayer;
    state.currentRetry = undefined;
    if (state.tenantPaused) {
      state.tenantPaused = false;
      state.tenantPausedAt = undefined;
    }
  }

  appendEvent(state, {
    type: "recovery",
    timestamp: new Date().toISOString(),
    fromLayer: previousLayer,
    toLayer: restoredLayer,
    message: `${layerName(restoredLayer)} restored and validated.`,
  });

  await saveKeyState(workdir, state);

  logger.info("tiger_keys: key restored", {
    restoredLayer,
    previousLayer,
    newActiveLayer: state.activeLayer,
  });

  const wasResumed = shouldSwitch && previousLayer !== restoredLayer;

  const output = [
    `✅ ${layerName(restoredLayer)} validated and restored.`,
    wasResumed ? `Switched from ${layerName(previousLayer)} back to ${layerName(restoredLayer)}.` : "",
    `Your bot is fully operational. Flywheel is running.`,
  ].filter(Boolean).join("\n");

  return {
    ok: true,
    output,
    data: {
      restoredLayer,
      previousLayer,
      newActiveLayer: state.activeLayer,
      tenantPaused: state.tenantPaused,
    },
  };
}

// ---------------------------------------------------------------------------
// Action: record_message
// ---------------------------------------------------------------------------

async function handleRecordMessage(
  state: KeyState,
  workdir: string,
  tenantId: string,
  logger: ToolContext["logger"]
): Promise<ToolResult> {
  const today = new Date().toISOString().slice(0, 10);
  const layer = state.activeLayer;

  // Backup key (Layer 3): enforce daily limit
  if (layer === 3) {
    if (state.layer3CountDate !== today) {
      state.layer3MessageCountToday = 0;
      state.layer3CountDate = today;
    }
    state.layer3MessageCountToday++;
    const remaining = LAYER_LIMITS[3].dailyMessages - state.layer3MessageCountToday;

    if (state.layer3MessageCountToday > LAYER_LIMITS[3].dailyMessages) {
      appendEvent(state, {
        type: "limit_exceeded",
        timestamp: new Date().toISOString(),
        message: `Backup key daily limit reached (${LAYER_LIMITS[3].dailyMessages} messages).`,
      });

      const rotation = await performRotation(state, 3, "Backup key daily message limit reached", workdir, tenantId, logger);
      await saveKeyState(workdir, state);

      return {
        ok: true,
        output: rotation.tenantMessage,
        data: { layer, limitExceeded: true, rotatedTo: rotation.toLayer },
      };
    }

    if (remaining <= 5) {
      appendEvent(state, {
        type: "limit_warning",
        timestamp: new Date().toISOString(),
        message: `Backup key: ${remaining} messages remaining today.`,
      });
      await saveKeyState(workdir, state);

      logger.warn("tiger_keys: Backup key approaching daily limit", { remaining });
      return {
        ok: true,
        output: `⚠️ Backup key running low: ${remaining} messages left today. Please restore your primary key.`,
        data: { layer, remaining, warning: true },
      };
    }

    await saveKeyState(workdir, state);
    return { ok: true, output: "", data: { layer, remaining } };
  }

  // Primary key (Layer 2): no Tiger Claw limits — just track for logging
  await saveKeyState(workdir, state);
  return { ok: true, output: "", data: { layer, unlimited: true } };
}

// ---------------------------------------------------------------------------
// Action: rotate (manual override)
// ---------------------------------------------------------------------------

async function handleRotate(
  params: RotateParams,
  state: KeyState,
  workdir: string,
  tenantId: string,
  logger: ToolContext["logger"]
): Promise<ToolResult> {
  if (state.tenantPaused) {
    return {
      ok: true,
      output: "Bot is already paused. Restore API keys first.",
      data: { decision: "no_action", tenantPaused: true },
    };
  }

  const reason = params.reason ?? "Manual rotation requested";
  logger.info("tiger_keys: manual rotation", { fromLayer: state.activeLayer, reason });

  const result = await performRotation(state, state.activeLayer, reason, workdir, tenantId, logger);

  return {
    ok: true,
    output: result.tenantMessage,
    data: {
      fromLayer: state.activeLayer,
      toLayer: result.toLayer,
      tenantPaused: state.tenantPaused,
      adminAlerted: result.adminAlert,
    },
  };
}

// ---------------------------------------------------------------------------
// Action: status
// ---------------------------------------------------------------------------

function handleStatus(state: KeyState): ToolResult {
  const today = new Date().toISOString().slice(0, 10);

  const lines = [
    `Key Management Status`,
    `Active: ${layerName(state.activeLayer)}`,
    `Bot paused: ${state.tenantPaused ? `Yes (since ${state.tenantPausedAt})` : "No"}`,
    ``,
    `Key limits:`,
    `  Primary Key: No Tiger Claw limit`,
  ];

  const layer3Today = state.layer3CountDate === today ? state.layer3MessageCountToday : 0;
  lines.push(`  Backup Key: ${layer3Today}/${LAYER_LIMITS[3].dailyMessages} messages today`);

  const recentEvents = state.events.slice(-5);
  if (recentEvents.length > 0) {
    lines.push(``);
    lines.push(`Recent events:`);
    for (const event of recentEvents) {
      const ts = new Date(event.timestamp).toLocaleString();
      lines.push(`  ${ts} — ${event.type}: ${event.message}`);
    }
  }

  if (state.currentRetry) {
    lines.push(``);
    lines.push(`Active retry: ${state.currentRetry.attempts} attempts (${state.currentRetry.errorType})`);
  }

  return {
    ok: true,
    output: lines.join("\n"),
    data: {
      activeLayer: state.activeLayer,
      tenantPaused: state.tenantPaused,
      layer3MessageCountToday: layer3Today,
      layer3DailyLimit: LAYER_LIMITS[3].dailyMessages,
      currentRetry: state.currentRetry ?? null,
      recentEvents,
    },
  };
}

// ---------------------------------------------------------------------------
// Main execute dispatcher
// ---------------------------------------------------------------------------

async function execute(
  params: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const { logger } = context;
  const workdir = context.sessionKey;
  const action = params.action as string;
  const tenantId = (context.config["TIGER_CLAW_TENANT_ID"] as string) ?? "unknown";

  logger.info("tiger_keys called", { action });

  const state = await loadKeyState(workdir);

  try {
    switch (action) {
      case "report_error":
        return await handleReportError(params as unknown as ReportErrorParams, state, workdir, tenantId, logger);

      case "restore_key":
        return await handleRestoreKey(params as unknown as RestoreKeyParams, state, workdir, logger);

      case "record_message":
        return await handleRecordMessage(state, workdir, tenantId, logger);

      case "rotate":
        return await handleRotate(params as unknown as RotateParams, state, workdir, tenantId, logger);

      case "status":
        return handleStatus(state);

      default:
        return {
          ok: false,
          error: `Unknown action: "${action}". Valid: report_error | restore_key | record_message | rotate | status`,
        };
    }
  } catch (err) {
    logger.error("tiger_keys error", { action, err: String(err) });
    return {
      ok: false,
      error: `tiger_keys error in action "${action}": ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool export
// ---------------------------------------------------------------------------

export const tiger_keys = {
  name: "tiger_keys",
  description:
    "Primary + Backup key management. Tracks which key is active, enforces Backup key daily limit (20/day), manages the rotation cascade (Primary→Backup→Pause), handles exponential backoff with jitter, and validates restored keys before accepting. Call record_message before every LLM call. Call report_error with the HTTP status after any LLM API failure to get the rotation decision. Call restore_key when the tenant provides a new key.",

  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["report_error", "restore_key", "record_message", "rotate", "status"],
        description:
          "report_error: classify an API error and get rotation decision. restore_key: validate and restore a tenant key. record_message: increment counter for current layer (call before every LLM message). rotate: manual layer rotation. status: show active key and limits.",
      },
      httpStatus: {
        type: "number",
        description: "HTTP status code from the failed API call (for report_error).",
      },
      isTimeout: {
        type: "boolean",
        description: "True if the call timed out with no HTTP response (for report_error).",
      },
      retryAfterSeconds: {
        type: "number",
        description: "Value from Retry-After header on 429 responses (for report_error).",
      },
      layer: {
        type: "string",
        enum: ["2", "3"],
        description: "Which key to restore — 2 (Primary) or 3 (Backup). For restore_key only.",
      },
      apiKey: {
        type: "string",
        description: "The new API key to validate and restore. For restore_key only.",
      },
      reason: {
        type: "string",
        description: "Reason for manual rotation (for rotate action, optional).",
      },
    },
    required: ["action"],
  },

  execute,
};

export default tiger_keys;
