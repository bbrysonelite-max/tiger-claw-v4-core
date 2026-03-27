import { ToolContext, ToolResult } from "./ToolContext.js";
// Tiger Claw — tiger_objection Tool
// Objection handling library with per-flavor buckets — Block 3.6 of TIGERCLAW-MASTER-SPEC-v2.md
//
// LOCKED:
//   Each flavor defines its own objection buckets with pre-built content.
//   Agent matches prospect text → bucket → delivers response.
//   Pattern Interrupt Stories: deployed at stall points, NOT randomly.
//   Flagship: The Airplane Question (network-marketer flavor).

import { getBotState, getHiveSignalWithFallback } from "../services/db.js";
import { getTenantState, saveTenantState } from "../services/tenant_data.js";
import { emitHiveEvent, hiveAttributionLabel } from "../services/hiveEmitter.js";
import { loadFlavorConfig } from "./flavorConfig.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AnyBucket = string;
type PatternInterruptMoment = "stall" | "pre_takeaway" | "general";

interface ObjectionLogEntry {
  id: string;
  leadId?: string;
  prospectText?: string;
  bucket: AnyBucket;
  flavor: string;
  responseText: string;
  loggedAt: string;
}

interface ObjectionLog {
  entries: ObjectionLogEntry[];
}

interface OnboardState {
  phase: string;
  flavor: string;
  region?: string;
  identity: {
    name?: string;
    productOrOpportunity?: string;
    yearsInProfession?: string;
    biggestWin?: string;
    differentiator?: string;
  };
  botName?: string;
}

// ---------------------------------------------------------------------------
// Template substitution
// ---------------------------------------------------------------------------

export function fillTemplate(template: string, onboard: OnboardState): string {
  return template
    .replace(/\{tenantName\}/g, onboard.identity.name ?? "your operator")
    .replace(/\{years\}/g, onboard.identity.yearsInProfession ?? "several years")
    .replace(/\{biggestWin\}/g, onboard.identity.biggestWin ?? "built a strong track record")
    .replace(/\{product\}/g, onboard.identity.productOrOpportunity ?? "the opportunity")
    .replace(/\{differentiator\}/g, onboard.identity.differentiator ?? "takes a genuinely different approach")
    .replace(/\{botName\}/g, onboard.botName ?? "your Tiger Claw bot");
}

// ---------------------------------------------------------------------------
// Classify objection
// ---------------------------------------------------------------------------

export function classifyBucket(text: string, flavorConfig: any): AnyBucket {
  const lower = text.toLowerCase();
  let best: AnyBucket = "unknown";
  let bestScore = 0;

  for (const bucket of flavorConfig.objectionBuckets) {
    const score = bucket.keywords.filter((kw: string) => lower.includes(kw.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      best = bucket.key;
    }
  }

  return best;
}

export function getBucketResponse(bucketKey: AnyBucket, flavorKey: string, _region: string): { responseTemplate: string; followUpQuestion: string } | null {
  if (bucketKey === "unknown") return null;
  const flavorConfig = loadFlavorConfig(flavorKey);
  return flavorConfig.objectionBuckets.find(b => b.key === bucketKey) ?? null;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function loadOnboard(tenantId: string): Promise<OnboardState | null> {
  const data = await getBotState(tenantId, "onboard_state.json");
  return (data as OnboardState) ?? null;
}

async function appendLog(tenantId: string, entry: ObjectionLogEntry): Promise<void> {
  const data = await getTenantState<ObjectionLog>(tenantId, "objection_log.json");
  let log: ObjectionLog = data ?? { entries: [] };
  
  log.entries.push(entry);
  if (log.entries.length > 500) log.entries = log.entries.slice(-500);
  
  await saveTenantState(tenantId, "objection_log.json", log);
}

// ---------------------------------------------------------------------------
// Action: classify
// ---------------------------------------------------------------------------

interface ClassifyParams {
  action: "classify";
  prospectText: string;
  leadId?: string;
  autoLog?: boolean;
}

async function handleClassify(
  params: ClassifyParams,
  tenantId: string,
  logger: ToolContext["logger"],
  region: string
): Promise<ToolResult> {
  const onboard = await loadOnboard(tenantId);
  if (!onboard || onboard.phase !== "complete") {
    return { ok: false, error: "Onboarding not complete." };
  }

  const flavor = onboard.flavor ?? "network-marketer";
  const config = loadFlavorConfig(flavor);
  const bucketKey = classifyBucket(params.prospectText, config);
  const bucketDef = config.objectionBuckets.find(b => b.key === bucketKey);

  const responseText = bucketDef
    ? fillTemplate(bucketDef.responseTemplate, onboard) +
      "\n\n" +
      fillTemplate(bucketDef.followUpQuestion, onboard)
    : fillTemplate(
        `I hear you — "{prospectText}". Let me connect you with {tenantName} directly — they can answer that better than I can.\n\n{followUp}`,
        onboard
      )
        .replace(/\{prospectText\}/g, params.prospectText.slice(0, 60))
        .replace(/\{followUp\}/g, "Is there a good time for a quick conversation?");

  if (params.autoLog !== false) {
    await appendLog(tenantId, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      leadId: params.leadId,
      prospectText: params.prospectText,
      bucket: bucketKey,
      flavor,
      responseText,
      loggedAt: new Date().toISOString(),
    });
  }

  logger.info("tiger_objection: classify", { bucket: bucketKey, flavor });

  const label = bucketDef?.label ?? "Unknown objection";
  
  const hiveSignal = await getHiveSignalWithFallback('objection', flavor, region).catch(() => null);
  let hiveApproach = "";
  if (hiveSignal && Array.isArray((hiveSignal.payload as any).patterns)) {
    const patterns = (hiveSignal.payload as any).patterns;
    const match = patterns.find((p: any) => p.objection === bucketKey || p.objection === 'general') || patterns[0];
    if (match && match.approach) {
      hiveApproach = `🌟 Hive Strategy (${hiveAttributionLabel(hiveSignal)}): ${match.approach}`;
    }
  }

  const outputLines = [
    `Classified as: ${bucketKey} (${label})`,
    ``,
    `Response:`,
    `---`,
    responseText,
    `---`,
  ];
  
  if (hiveApproach) {
    outputLines.push(``, hiveApproach);
  }

  return {
    ok: true,
    output: outputLines.join("\n"),
    data: { bucket: bucketKey, label, responseText, flavor, hiveApproach: hiveApproach || undefined },
  };
}

// ---------------------------------------------------------------------------
// Action: respond (direct bucket lookup)
// ---------------------------------------------------------------------------

interface RespondParams {
  action: "respond";
  bucket: string;
  leadId?: string;
}

async function handleRespond(
  params: RespondParams,
  tenantId: string,
  logger: ToolContext["logger"],
  region: string
): Promise<ToolResult> {
  const onboard = await loadOnboard(tenantId);
  if (!onboard || onboard.phase !== "complete") {
    return { ok: false, error: "Onboarding not complete." };
  }

  const flavor = onboard.flavor ?? "network-marketer";
  const config = loadFlavorConfig(flavor);
  const bucketDef = config.objectionBuckets.find(b => b.key === params.bucket);

  if (!bucketDef) {
    return {
      ok: false,
      error: `Bucket "${params.bucket}" not found for flavor "${flavor}". Call list_buckets to see available options.`,
    };
  }

  const responseText =
    fillTemplate(bucketDef.responseTemplate, onboard) +
    "\n\n" +
    fillTemplate(bucketDef.followUpQuestion, onboard);

  await appendLog(tenantId, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    leadId: params.leadId,
    bucket: params.bucket,
    flavor,
    responseText,
    loggedAt: new Date().toISOString(),
  });

  logger.info("tiger_objection: respond", { bucket: params.bucket, flavor });

  const hiveSignal = await getHiveSignalWithFallback('objection', flavor, region).catch(() => null);
  let hiveApproach = "";
  if (hiveSignal && Array.isArray((hiveSignal.payload as any).patterns)) {
    const patterns = (hiveSignal.payload as any).patterns;
    const match = patterns.find((p: any) => p.objection === params.bucket || p.objection === 'general') || patterns[0];
    if (match && match.approach) {
      hiveApproach = `🌟 Hive Strategy (${hiveAttributionLabel(hiveSignal)}): ${match.approach}`;
    }
  }

  const outputLines = [`${bucketDef.label} response:`, `---`, responseText, `---`];
  if (hiveApproach) {
    outputLines.push(``, hiveApproach);
  }

  return {
    ok: true,
    output: outputLines.join("\n"),
    data: { bucket: params.bucket, label: bucketDef.label, responseText, flavor, hiveApproach: hiveApproach || undefined },
  };
}

// ---------------------------------------------------------------------------
// Action: pattern_interrupt
// ---------------------------------------------------------------------------

interface PatternInterruptParams {
  action: "pattern_interrupt";
  moment?: PatternInterruptMoment;
  storyName?: string;
}

async function handlePatternInterrupt(
  params: PatternInterruptParams,
  tenantId: string,
  logger: ToolContext["logger"],
  _region: string
): Promise<ToolResult> {
  const onboard = await loadOnboard(tenantId);
  if (!onboard || onboard.phase !== "complete") {
    return { ok: false, error: "Onboarding not complete." };
  }

  const flavor = onboard.flavor ?? "network-marketer";
  const config = loadFlavorConfig(flavor);
  const stories = config.patternInterrupts;
  const moment = params.moment ?? "general";

  let story: any | undefined;

  if (params.storyName) {
    story = stories.find((s: any) => s.name.toLowerCase() === params.storyName!.toLowerCase());
  }

  if (!story) {
    story = stories.find((s: any) => s.moments.includes(moment)) ?? stories[0];
  }

  if (!story) {
    return { ok: false, error: `No pattern interrupt stories found for flavor "${flavor}".` };
  }

  const storyText = fillTemplate(story.storyTemplate, onboard);

  logger.info("tiger_objection: pattern_interrupt", { story: story.name, moment, flavor });

  return {
    ok: true,
    output: [`Pattern interrupt: "${story.name}"`, `Moment: ${moment}`, ``, `---`, storyText, `---`].join("\n"),
    data: { storyName: story.name, moment, storyText, flavor },
  };
}

// ---------------------------------------------------------------------------
// Action: list_buckets
// ---------------------------------------------------------------------------

async function handleListBuckets(tenantId: string, logger: ToolContext["logger"]): Promise<ToolResult> {
  const onboard = await loadOnboard(tenantId);
  const flavor = onboard?.flavor ?? "network-marketer";
  const region = onboard?.region ?? "us-en";

  const config = loadFlavorConfig(flavor);
  const buckets = config.objectionBuckets;
  const lines = [`Objection buckets for flavor "${flavor}" (region: ${region}):`, ``];

  for (const def of buckets) {
    lines.push(`  ${def.key.padEnd(20)} ${def.label}`);
  }

  const stories = config.patternInterrupts;
  lines.push(``, `Pattern interrupt stories:`);
  for (const s of stories) {
    lines.push(`  "${s.name}" — moments: ${s.moments.join(", ")}`);
  }

  return {
    ok: true,
    output: lines.join("\n"),
    data: {
      flavor,
      buckets: buckets.map(b => b.key),
      patternInterrupts: stories.map((s: any) => ({ name: s.name, moments: s.moments })),
    },
  };
}

// ---------------------------------------------------------------------------
// Action: log
// ---------------------------------------------------------------------------

interface LogParams {
  action: "log";
  bucket: string;
  leadId?: string;
  prospectText?: string;
  notes?: string;
  regulatoryViolation?: boolean;
}

async function handleLog(params: LogParams, tenantId: string): Promise<ToolResult> {
  const onboard = await loadOnboard(tenantId);
  const flavor = onboard?.flavor ?? "network-marketer";

  await appendLog(tenantId, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    leadId: params.leadId,
    prospectText: params.prospectText,
    bucket: params.bucket,
    flavor,
    responseText: params.notes ?? "",
    loggedAt: new Date().toISOString(),
  });

  if (params.regulatoryViolation) {
    emitHiveEvent(tenantId, "regulatory_violation", {
      bucket: params.bucket,
      flavor,
      violationDetected: true
    }).catch(() => {});
  }

  return {
    ok: true,
    output: `Objection logged: ${params.bucket}${params.leadId ? ` for lead ${params.leadId}` : ""}.${params.regulatoryViolation ? " Regulatory violation flagged to Hive." : ""}`,
    data: { bucket: params.bucket, flavor, regulatoryViolation: !!params.regulatoryViolation },
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
  const tenantId = context.sessionKey;
  const action = params.action as string;
  const region = (context.config["REGION"] as string) ?? "us-en";

  logger.info("tiger_objection called", { action });

  try {
    switch (action) {
      case "classify":
        return await handleClassify(params as unknown as ClassifyParams, tenantId, logger, region);
      case "respond":
        return await handleRespond(params as unknown as RespondParams, tenantId, logger, region);
      case "pattern_interrupt":
        return await handlePatternInterrupt(params as unknown as PatternInterruptParams, tenantId, logger, region);
      case "list_buckets":
        return await handleListBuckets(tenantId, logger);
      case "log":
        return await handleLog(params as unknown as LogParams, tenantId);
      default:
        return {
          ok: false,
          error: `Unknown action: "${action}". Valid: classify | respond | pattern_interrupt | list_buckets | log`,
        };
    }
  } catch (err) {
    logger.error("tiger_objection error", { action, err: String(err) });
    return {
      ok: false,
      error: `tiger_objection error in action "${action}": ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool export
// ---------------------------------------------------------------------------

export const tiger_objection = {
  name: "tiger_objection",
  description:
    "Objection handling library with per-flavor buckets and pattern interrupt stories. Classify prospect text into an objection bucket and get a templated response using the tenant's real credentials. OR look up a specific bucket directly. OR fire a pattern interrupt story at a stall point. Pattern interrupts deployed at stall points and pre-takeaway — NOT randomly. Logs all objection events to objection_log.json.",

  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["classify", "respond", "pattern_interrupt", "list_buckets", "log"],
        description: "Action to perform.",
      },
      prospectText: { type: "string" },
      bucket: { type: "string" },
      leadId: { type: "string" },
      moment: { type: "string", enum: ["stall", "pre_takeaway", "general"] },
      storyName: { type: "string" },
      notes: { type: "string" },
      autoLog: { type: "boolean" },
      regulatoryViolation: { type: "boolean" },
    },
    required: ["action"],
  },

  execute,
};

export default tiger_objection;
