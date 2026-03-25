// Tiger Claw API — Admin Fleet Management Routes
// TIGERCLAW-MASTER-SPEC-v2.md Block 5.3, Block 6.1
//
// Endpoints:
//   POST /admin/provision          — manual provision (comped/gifted tenant)
//   GET  /admin/fleet              — list all tenants with health summary
//   GET  /admin/fleet/:tenantId    — single tenant detail
//   POST /admin/fleet/:tenantId/report    — trigger manual daily report
//   POST /admin/fleet/:tenantId/suspend   — suspend tenant
//   POST /admin/fleet/:tenantId/resume    — resume suspended tenant
//   DELETE /admin/fleet/:tenantId         — terminate tenant
//   GET  /admin/fleet/:tenantId/logs      — tail last 50 container log lines
//
// All admin routes require ADMIN_TOKEN header:
//   Authorization: Bearer <ADMIN_TOKEN>

import { Router, type Request, type Response, type NextFunction } from "express";
import TelegramBot from "node-telegram-bot-api";
import {
  listTenants,
  getTenant,
  getTenantBySlug,
  logAdminEvent,
  setCanaryGroup,
  listCanaryTenants,
  listBotPool,
  getRecentAdminEvents,
  getPoolStats,
  getPool,
  type Tenant,
} from "../services/db.js";
import {
  provisionTenant,
  suspendTenant,
  resumeTenant,
  terminateTenant,
  deprovisionTenant,
  type ProvisionInput,
} from "../services/provisioner.js";
import {
  importToken,
  importBatch,
  assignToTenant,
  releaseBot,
  retireBot,
  getPoolStatus,
  getBotPoolEntryByUsername,
} from "../services/pool.js";

const router = Router();

// ---------------------------------------------------------------------------
// Admin auth middleware
// ---------------------------------------------------------------------------

const ADMIN_TOKEN = process.env["ADMIN_TOKEN"] ?? "";

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  
  if (token === ADMIN_TOKEN) {
    next();
    return;
  }
  
  res.status(401).json({ error: "Unauthorized" });
}

router.use(requireAdmin);

// ── POST /admin/fix-all-webhooks ─────────────────────────────────────────────
// Nuclear option to restore webhooks for all assigned bots and wire the secret.
// Reads TELEGRAM_WEBHOOK_SECRET from env and includes it in the setWebhook call.
router.post("/fix-all-webhooks", async (req: Request, res: Response) => {
  try {
    // V4 arch: bot tokens live in bot_pool (encrypted), not on the tenants table.
    // JOIN bot_pool to get the encrypted token, then decrypt before calling Telegram.
    const rows = await getPool().query(`
      SELECT t.id, t.slug, bp.bot_token AS encrypted_token
      FROM tenants t
      INNER JOIN bot_pool bp ON bp.tenant_id = t.id AND bp.status = 'assigned'
      WHERE t.status IN ('active', 'onboarding', 'suspended')
    `);

    const { decryptToken } = await import("../services/pool.js");
    const webhookSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];
    const baseUrl = (process.env["TIGER_CLAW_API_URL"] ?? "https://api.tigerclaw.io").replace(/\/$/, "");

    console.log(`[fix-webhooks] Re-binding ${rows.rows.length} tenants. Secret: ${webhookSecret ? "✅ wired" : "⚠️  missing"}`);
    const results: { slug: string; status: string; msg?: string }[] = [];

    for (const row of rows.rows) {
      try {
        const token = decryptToken(row.encrypted_token);
        const webhookUrl = `${baseUrl}/webhooks/telegram/${row.id}`;

        const body: Record<string, string> = { url: webhookUrl };
        if (webhookSecret) body.secret_token = webhookSecret;

        const tgResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const tgData = await tgResponse.json() as { ok: boolean; description?: string };

        if (tgData.ok) {
          results.push({ slug: row.slug, status: "fixed" });
        } else {
          results.push({ slug: row.slug, status: "error", msg: tgData.description });
        }
      } catch (e: any) {
        results.push({ slug: row.slug, status: "failed", msg: e.message });
      }
    }

    return res.json({
      ok: true,
      secretWired: !!webhookSecret,
      processed: rows.rows.length,
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /admin/provision — manual provisioning
// ---------------------------------------------------------------------------

router.post("/provision", async (req: Request, res: Response) => {
  const body = req.body as Partial<ProvisionInput>;

  const required: (keyof ProvisionInput)[] = ["slug", "name", "flavor", "region", "language", "preferredChannel"];
  const missing = required.filter((k) => !body[k]);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  }

  try {
    const result = await provisionTenant(body as ProvisionInput);
    return res.status(result.success ? 201 : 500).json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /admin/costs — GAP 3: API cost per tenant (key abuse tracking)
// ---------------------------------------------------------------------------

router.get("/costs", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getPool: pg } = await import("../services/db.js");
    const pool = pg();

    // Count platform key usage per tenant (Layer 1/4 = operator cost)
    const result = await pool.query(`
      SELECT
        t.id,
        t.slug,
        t.name,
        t.status,
        COALESCE(e.platform_calls, 0) AS platform_key_calls,
        COALESCE(e.byok_calls, 0) AS byok_calls,
        COALESCE(e.emergency_calls, 0) AS emergency_calls,
        COALESCE(e.abuse_incidents, 0) AS abuse_incidents
      FROM tenants t
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE key_layer = 1) AS platform_calls,
          COUNT(*) FILTER (WHERE key_layer = 2) AS byok_calls,
          COUNT(*) FILTER (WHERE key_layer = 4) AS emergency_calls,
          COUNT(*) FILTER (WHERE event_type = 'abuse') AS abuse_incidents
        FROM admin_events ae
        WHERE ae.tenant_id = t.id
          AND ae.action LIKE 'key_layer_%'
      ) e ON true
      ORDER BY platform_key_calls DESC, emergency_calls DESC
    `).catch(() => ({ rows: [] }));

    // Fallback: if the admin_events doesn't track key_layer, just return tenant list with zeros
    const tenants = await listTenants();
    const costData = tenants.map(t => {
      const row = (result.rows as Record<string, unknown>[]).find(
        r => r["id"] === t.id
      );
      return {
        tenantId: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        platformKeyCalls: Number(row?.["platform_calls"] ?? 0),
        byokCalls: Number(row?.["byok_calls"] ?? 0),
        emergencyCalls: Number(row?.["emergency_calls"] ?? 0),
        abuseIncidents: Number(row?.["abuse_incidents"] ?? 0),
        estimatedCost: `$${(Number(row?.["platform_calls"] ?? 0) * 0.005 + Number(row?.["emergency_calls"] ?? 0) * 0.005).toFixed(2)}`,
      };
    });

    return res.json({
      tenants: costData,
      totals: {
        platformCalls: costData.reduce((s, c) => s + c.platformKeyCalls, 0),
        byokCalls: costData.reduce((s, c) => s + c.byokCalls, 0),
        emergencyCalls: costData.reduce((s, c) => s + c.emergencyCalls, 0),
        estimatedCost: `$${costData.reduce((s, c) => s + parseFloat(c.estimatedCost.slice(1)), 0).toFixed(2)}`,
      },
    });
  } catch (err) {
    console.error("[admin] GET /costs error:", err);
    return res.status(500).json({ error: "Failed to fetch costs" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/metrics — GAP 3 + Hive Phase 4: High-level platform metrics
// ---------------------------------------------------------------------------

router.get("/metrics", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getPool: pg } = await import("../services/db.js");
    const pool = pg();

    const [founders, signals, events, fleets] = await Promise.all([
      pool.query(`SELECT COUNT(*) as cx FROM tenants WHERE is_founding_member = true`),
      pool.query(`SELECT COUNT(*) as cx FROM hive_signals`),
      pool.query(`SELECT COUNT(*) as cx FROM hive_events`),
      pool.query(`SELECT COUNT(*) as cx FROM tenants WHERE status = 'active'`)
    ]);

    return res.json({
      activeTenants: parseInt(fleets.rows[0].cx, 10),
      foundingMembers: parseInt(founders.rows[0].cx, 10),
      totalHiveSignals: parseInt(signals.rows[0].cx, 10),
      totalHiveEvents: parseInt(events.rows[0].cx, 10)
    });
  } catch (err) {
    console.error("[admin] GET /metrics error:", err);
    return res.status(500).json({ error: "Failed to fetch top-level metrics" });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/flavors — GAP 3: flavor distribution across tenants
// ---------------------------------------------------------------------------

router.get("/flavors", requireAdmin, async (_req: Request, res: Response) => {
  const tenants = await listTenants();
  const distribution: Record<string, number> = {};
  for (const t of tenants) {
    const flavor = t.flavor ?? "unknown";
    distribution[flavor] = (distribution[flavor] ?? 0) + 1;
  }

  const { listFlavors } = await import("../tools/flavorConfig.js");
  const allFlavors = listFlavors();

  return res.json({
    distribution,
    available: allFlavors,
    totalTenants: tenants.length,
  });
});

// ---------------------------------------------------------------------------
// GET /admin/dashboard/tenants — Priority 1: Visual Canary Dashboard
// Returns all tenants with their bot username, last activity, and exact onboarding phase.
// ---------------------------------------------------------------------------

router.get("/dashboard/tenants", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getPool, getBotState } = await import("../services/db.js");
    const pool = getPool();
    
    const result = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.slug,
        t.status,
        t.canary_group,
        t.last_activity_at,
        b.bot_username
      FROM tenants t
      LEFT JOIN bot_pool b ON b.tenant_id = t.id AND b.status = 'assigned'
      ORDER BY t.created_at DESC
    `);
    
    // Resolve dynamic onboarding state per tenant schema mapping
    const dashboardData = await Promise.all(result.rows.map(async (row) => {
      let onboardingComplete = (row.status === 'active' || row.status === 'live');
      let onboardingPhase = 'incomplete';
      
      if (!onboardingComplete) {
        try {
          const state = await getBotState<any>(row.id, "onboard_state.json");
          if (state && state.phase === 'complete') {
             onboardingComplete = true;
             onboardingPhase = 'complete';
          } else if (state && state.phase) {
             onboardingPhase = state.phase;
          }
        } catch(e) { /* schema likely not fully populated */ }
      } else {
        onboardingPhase = 'complete';
      }

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        isCanary: row.canary_group,
        botUsername: row.bot_username ? `@${row.bot_username}` : 'Unassigned',
        status: row.status,
        onboardingComplete,
        onboardingPhase,
        lastActive: row.last_activity_at ? new Date(row.last_activity_at).toISOString() : 'Never',
      };
    }));

    return res.json({ tenants: dashboardData });
  } catch (err) {
    console.error("[admin] Dashboard tenants error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fleet — list all tenants
// ---------------------------------------------------------------------------

router.get("/fleet", async (_req: Request, res: Response) => {
  try {
    const tenants = await listTenants();
    res.json({
      count: tenants.length,
      tenants: tenants.map(tenantSummary),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fleet/:tenantId — single tenant detail with live health
// ---------------------------------------------------------------------------

router.get("/fleet/:tenantId", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    return res.json({
      ...tenantSummary(tenant),
      health: { httpReachable: tenant.status === 'active' || tenant.status === 'onboarding' },
      containerStats: null,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/fleet/:tenantId/report — trigger manual daily report
// ---------------------------------------------------------------------------

router.post("/fleet/:tenantId/report", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    if (tenant.status !== "active") {
      return res.status(400).json({ error: "Tenant is not active" });
    }
    const triggered = await triggerContainerWebhook(tenant, "tiger_briefing", { action: "generate" });
    await logAdminEvent("manual_report", tenant.id, { triggered });
    return res.json({ ok: true, triggered, tenantId: tenant.id });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/fleet/:tenantId/suspend
// ---------------------------------------------------------------------------

router.post("/fleet/:tenantId/suspend", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const reason = (req.body as { reason?: string })["reason"] ?? "Admin suspension";
    await suspendTenant(tenant, reason);
    return res.json({ ok: true, tenantId: tenant.id, status: "suspended" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/fleet/:tenantId/resume
// ---------------------------------------------------------------------------

router.post("/fleet/:tenantId/resume", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    if (tenant.status !== "suspended") {
      return res.status(400).json({ error: "Tenant is not suspended" });
    }
    const resumedStatus = await resumeTenant(tenant);
    return res.json({ ok: true, tenantId: tenant.id, status: resumedStatus });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/fleet/:tenantId — terminate (permanent)
// ---------------------------------------------------------------------------

router.delete("/fleet/:tenantId", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await terminateTenant(tenant);
    return res.json({ ok: true, tenantId: tenant.id, status: "terminated" });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/canary — list all tenants designated in the canary group
// Used by ops/deploy.sh canary to fetch the designated canary slugs
// ---------------------------------------------------------------------------

router.get("/canary", async (_req: Request, res: Response) => {
  try {
    const tenants = await listCanaryTenants();
    res.json({
      count: tenants.length,
      tenants: tenants.map(tenantSummary),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/fleet/:tenantId/canary — add tenant to canary group
// ---------------------------------------------------------------------------

router.post("/fleet/:tenantId/canary", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await setCanaryGroup(tenant.id, true);
    await logAdminEvent("canary_add", tenant.id);
    return res.json({ ok: true, tenantId: tenant.id, slug: tenant.slug, canaryGroup: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// DELETE /admin/fleet/:tenantId/canary — remove tenant from canary group
// ---------------------------------------------------------------------------

router.delete("/fleet/:tenantId/canary", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await setCanaryGroup(tenant.id, false);
    await logAdminEvent("canary_remove", tenant.id);
    return res.json({ ok: true, tenantId: tenant.id, slug: tenant.slug, canaryGroup: false });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/fleet/:tenantId/logs — tail container logs
// ---------------------------------------------------------------------------

router.get("/fleet/:tenantId/logs", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const lines = ["Multi-tenant infrastructure: Native container logs are deprecated. View central API logs for details."];
    return res.json({ tenantId: tenant.id, slug: tenant.slug, lines });
  } catch (err) {
    return res.status(500).json({
      error: `Could not fetch logs: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /admin/alerts — internal alert endpoint for skills and ops scripts
// Called by tiger_keys.ts (key rotation/recovery events) and
// pipeline-advance.sh (stage transitions, finalize reverts).
// Without this endpoint those callers silently 404 and admins are never notified.
// ---------------------------------------------------------------------------

router.post("/alerts", async (req: Request, res: Response) => {
  const { message, tenantId, severity } = req.body as {
    message?: string;
    tenantId?: string;
    severity?: string;
  };

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  try {
    const prefixed = severity === "high" ? `🚨 ${message}` : message;
    await sendAdminAlert(prefixed);
    if (tenantId) {
      await logAdminEvent("skill_alert", tenantId, { message, severity });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---------------------------------------------------------------------------
// GET /admin/events/recent — last 24h admin events for daily briefing
// ---------------------------------------------------------------------------

router.get("/events/recent", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const events = await getRecentAdminEvents(24);

    const keyFailures = events.filter((e) =>
      ["key_rotation", "onboarding_key_deactivated", "key_recovery"].includes(e.action) ||
      (e.details && (e.details as Record<string, unknown>)["type"] === "key_failure")
    );

    const containerRestarts = events.filter((e) =>
      e.action === "container_restart" ||
      (e.details && String((e.details as Record<string, unknown>)["message"] ?? "").includes("Auto-restarted"))
    );

    res.json({
      totalEvents: events.length,
      keyFailures: keyFailures.length,
      keyFailureDetails: keyFailures.map((e) => ({
        tenantName: e.tenantName ?? "unknown",
        action: e.action,
        at: e.createdAt,
        details: e.details,
      })),
      containerRestarts: containerRestarts.length,
      events: events.slice(0, 50),
    });
  } catch (err) {
    console.error("[admin] events/recent error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Admin Telegram alert utility (exported for use in webhooks.ts)
// ---------------------------------------------------------------------------

let adminBot: TelegramBot | null = null;
const ADMIN_CHAT_ID = process.env["ADMIN_TELEGRAM_CHAT_ID"] ?? "";
const ADMIN_BOT_TOKEN = process.env["ADMIN_TELEGRAM_BOT_TOKEN"] ?? "";

export async function sendAdminAlert(message: string): Promise<void> {
  if (!ADMIN_BOT_TOKEN || !ADMIN_CHAT_ID) return;

  try {
    if (!adminBot) adminBot = new TelegramBot(ADMIN_BOT_TOKEN);
    await adminBot.sendMessage(ADMIN_CHAT_ID, message);
  } catch (err) {
    console.error("[admin] Failed to send Telegram alert:", err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tenantSummary(t: Tenant) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    email: t.email,
    status: t.status,
    flavor: t.flavor,
    region: t.region,
    language: t.language,
    preferredChannel: t.preferredChannel,
    port: t.port,
    containerName: t.containerName,
    canaryGroup: t.canaryGroup,
    lastActivityAt: t.lastActivityAt?.toISOString(),
    suspendedAt: t.suspendedAt?.toISOString(),
    suspendedReason: t.suspendedReason,
    createdAt: t.createdAt.toISOString(),
  };
}

async function resolveTenant(idOrSlug: string): Promise<Tenant | null> {
  // Accept both UUID and slug — use targeted queries, not full table scan
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(idOrSlug)) {
    return getTenant(idOrSlug);
  }
  return getTenantBySlug(idOrSlug);
}

async function triggerContainerWebhook(
  tenant: Tenant,
  _skill: string,
  _payload: unknown
): Promise<boolean> {
  // BUG FIX: previous implementation called bot.getUpdates() (polling) which conflicts
  // with webhook mode — Telegram rejects polling when a webhook is registered.
  // Correct approach: enqueue a daily_scout routine via the routine queue.
  try {
    const { routineQueue } = await import("../services/queue.js");
    await routineQueue.add('daily_scout', {
      tenantId: tenant.id,
      routineType: 'daily_scout',
    }, {
      jobId: `manual_scout_${tenant.id}_${Date.now()}`,
      removeOnComplete: true,
    });
    return true;
  } catch (err) {
    console.error(`[admin] Failed to enqueue manual report for tenant ${tenant.id}:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Bot pool management — Block 5.3
// ---------------------------------------------------------------------------

// GET /admin/pool/status — pool stats (total, assigned, unassigned)
router.get("/pool/status", async (_req: Request, res: Response) => {
  try {
    const stats = await getPoolStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /admin/pool/health — GAP 6: pool health check with action recommendation
router.get("/pool/health", async (_req: Request, res: Response) => {
  try {
    const stats = await getPoolStats();
    const available = stats.unassigned ?? 0;
    const total = (stats.total ?? 0);

    let status: string;
    let action: string;

    if (available === 0) {
      status = "empty";
      action = "URGENT: Run 'npx tsx ops/botpool/create_bots.ts --mtproto --sessions ./sessions.json --count 50' immediately. New signups will be waitlisted.";
    } else if (available < 10) {
      status = "critical";
      action = "Create at least 20 bots. Run: npx tsx ops/botpool/create_bots.ts --mtproto --sessions ./sessions.json --count 20";
    } else if (available < 50) {
      status = "low";
      action = "Schedule a pool refill soon. Run: npx tsx ops/botpool/create_bots.ts --mtproto --sessions ./sessions.json --count 50";
    } else {
      status = "healthy";
      action = "No action needed.";
    }

    return res.json({
      status,
      available,
      assigned: stats.assigned ?? 0,
      total,
      action,
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /admin/pool/add — validated token import with waitlist sweep trigger.
// Accepts { botToken, phoneAccount? } from the ops/botpool/create_bots.ts script.
// Uses importToken() to validate via Telegram getMe, store real telegramBotId, and dedup correctly.
router.post("/pool/add", async (req: Request, res: Response) => {
  const { botToken, phoneAccount } = req.body as { botToken?: string; phoneAccount?: string };
  if (!botToken) {
    return res.status(400).json({ error: "botToken is required." });
  }
  try {
    const result = await importToken(botToken, phoneAccount);
    if (!result.ok) {
      // Duplicate = 409, invalid token = 422
      const status = (result.error ?? "").includes("already in pool") ? 409 : 422;
      return res.status(status).json(result);
    }

    // Background waitlist sweep: if a tenant was waitlisted due to empty pool,
    // automatically try to provision them now that a bot is available.
    setImmediate(async () => {
      try {
        const pool = getPool();
        const { rows } = await pool.query(
          `SELECT id, slug, name, email, flavor, region, language, preferred_channel
           FROM tenants WHERE status = 'waitlisted'
           ORDER BY updated_at ASC LIMIT 1`
        );
        if (rows.length > 0) {
          console.log(`[admin] Waitlist sweep: found tenant ${rows[0].id} (${rows[0].slug}). Enqueuing provision.`);
          const { provisionQueue } = await import("../services/queue.js");
          await provisionQueue.add("tenant-provisioning", {
            botId: rows[0].id,
            slug: rows[0].slug,
            name: rows[0].name,
            email: rows[0].email,
            flavor: rows[0].flavor,
            region: rows[0].region,
            language: rows[0].language,
            preferredChannel: rows[0].preferred_channel || "telegram",
          }, { attempts: 3, backoff: { type: "exponential", delay: 5000 } });
        }
      } catch (sweepErr) {
        console.error("[admin] Waitlist sweep error:", sweepErr);
      }
    });

    return res.json({ ok: true, username: result.username, telegramBotId: result.telegramBotId });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// GET /admin/pool — full pool listing with details
router.get("/pool", async (_req: Request, res: Response) => {
  try {
    const counts = await getPoolStatus();
    const all = await listBotPool();
    return res.json({
      counts,
      bots: all.map((b) => ({
        id: b.id,
        username: b.botUsername,
        telegramBotId: b.telegramBotId,
        status: b.status,
        phoneAccount: b.phoneAccount,
        assignedAt: b.assignedAt?.toISOString(),
        tenantId: b.tenantId,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /admin/pool/import — import a single token
router.post("/pool/import", async (req: Request, res: Response) => {
  const { token, phoneAccount } = req.body as { token?: string; phoneAccount?: string };
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const result = await importToken(token, phoneAccount);
    if (!result.ok) return res.status(422).json(result);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /admin/pool/import-batch — import multiple tokens (newline or array)
router.post("/pool/import-batch", async (req: Request, res: Response) => {
  const { tokens, phoneAccount } = req.body as { tokens?: string | string[]; phoneAccount?: string };
  if (!tokens) return res.status(400).json({ error: "tokens is required" });
  try {
    const list = Array.isArray(tokens)
      ? tokens
      : String(tokens).split(/\r?\n/).filter(Boolean);
    const result = await importBatch(list, phoneAccount);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /admin/pool/:botId/assign — manually assign to a tenant
router.post("/pool/:botId/assign", async (req: Request, res: Response) => {
  const { tenantId } = req.body as { tenantId?: string };
  if (!tenantId) return res.status(400).json({ error: "tenantId is required" });
  try {
    const tenant = await getTenant(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    await assignToTenant(req.params["botId"]!, tenantId);
    return res.json({ ok: true, tenantId: tenant.id, slug: tenant.slug });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /admin/pool/:botIdOrUsername/release — release back to available pool
router.post("/pool/:ref/release", async (req: Request, res: Response) => {
  const ref = req.params["ref"]!;
  try {
    let botId = ref;
    // Accept username (@handle or handle)
    if (ref.startsWith("@") || !/^[0-9a-f]{8}-/.test(ref)) {
      const entry = await getBotPoolEntryByUsername(ref);
      if (!entry) return res.status(404).json({ error: `Bot @${ref} not found in pool` });
      botId = entry.id;
    }
    await releaseBot(botId);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /admin/pool/:ref — retire a bot (token revoked/problematic)
router.delete("/pool/:ref", async (req: Request, res: Response) => {
  const ref = req.params["ref"]!;
  try {
    let botId = ref;
    if (ref.startsWith("@") || !/^[0-9a-f]{8}-/.test(ref)) {
      const entry = await getBotPoolEntryByUsername(ref);
      if (!entry) return res.status(404).json({ error: `Bot @${ref} not found in pool` });
      botId = entry.id;
    }
    await retireBot(botId);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /admin/fleet/:tenantId/deprovision — full cleanup with bot recycling
router.post("/fleet/:tenantId/deprovision", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const result = await deprovisionTenant(tenant);
    return res.json({ ok: true, steps: result.steps ?? [] });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /admin/fleet/:tenantId/reset-conversation ───────────────────────────
// Clears Redis chat history — next message triggers the first-message
// onboarding nudge, resetting the bot's personality flow for a canary.
router.post("/fleet/:tenantId/reset-conversation", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const { clearTenantChatHistory } = await import("../services/ai.js");
    const cleared = await clearTenantChatHistory(tenant.id);
    await logAdminEvent("conversation_reset", tenant.id, { keys_cleared: cleared });
    return res.json({ ok: true, keys_cleared: cleared });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /admin/fleet/:tenantId/founding-member ───────────────────────────────
// Mark a tenant as a founding member and enable their feedback loop.
router.post("/fleet/:tenantId/founding-member", async (req: Request, res: Response) => {
  try {
    const tenant = await resolveTenant(req.params["tenantId"]!);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const pool = getPool();
    await pool.query(
      `UPDATE tenants
       SET is_founding_member = true,
           founding_member_since = COALESCE(founding_member_since, now()),
           feedback_loop_enabled = true
       WHERE id = $1`,
      [tenant.id],
    );
    await logAdminEvent("founding_member_granted", tenant.id, {});
    return res.json({ ok: true, tenantId: tenant.id, slug: tenant.slug });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /admin/founding-members/bulk ─────────────────────────────────────────
// Mark multiple tenants as founding members in one call.
// Body: { tenantIds: string[] }
router.post("/founding-members/bulk", async (req: Request, res: Response) => {
  try {
    const { tenantIds } = req.body as { tenantIds?: string[] };
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: "tenantIds array required" });
    }
    const pool = getPool();
    await pool.query(
      `UPDATE tenants
       SET is_founding_member = true,
           founding_member_since = COALESCE(founding_member_since, now()),
           feedback_loop_enabled = true
       WHERE id = ANY($1::uuid[])`,
      [tenantIds],
    );
    for (const id of tenantIds) {
      await logAdminEvent("founding_member_granted", id, { bulk: true }).catch(() => {});
    }
    return res.json({ ok: true, updated: tenantIds.length });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Skills Curation Routes ────────────────────────────────────────────────────
// Skills are auto-drafted by the self-improvement engine on every tool failure.
// Admin reviews them here: list → approve/reject → optionally promote to platform.
//
// GET  /admin/skills              — list draft skills (paginated, filterable)
// POST /admin/skills/:id/approve  — approve a draft skill (tenant/flavor scope)
// POST /admin/skills/:id/reject   — reject a draft skill
// POST /admin/skills/:id/promote  — promote an approved skill to platform scope
// DELETE /admin/skills/:id        — hard delete a skill

router.get("/skills", async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const status = (req.query["status"] as string) ?? "draft";
    const scope = req.query["scope"] as string | undefined;
    const tenantId = req.query["tenantId"] as string | undefined;
    const limit = Math.min(parseInt(req.query["limit"] as string ?? "50", 10), 200);
    const offset = parseInt(req.query["offset"] as string ?? "0", 10);

    const conditions: string[] = ["status = $1"];
    const params: unknown[] = [status];
    let idx = 2;

    if (scope) { conditions.push(`scope = $${idx++}`); params.push(scope); }
    if (tenantId) { conditions.push(`tenant_id = $${idx++}`); params.push(tenantId); }

    const where = conditions.join(" AND ");
    const { rows } = await pool.query(
      `SELECT id, name, description, type, scope, tenant_id, flavor, status,
              trigger_tool, trigger_error, usage_count, success_count,
              created_by, created_at, updated_at
       FROM skills WHERE ${where}
       ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );

    const { rows: [{ count }] } = await pool.query(
      `SELECT COUNT(*) FROM skills WHERE ${where}`,
      params,
    );

    return res.json({ skills: rows, total: parseInt(count, 10), limit, offset });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/skills/:id/approve", async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { scope } = req.body as { scope?: string };
    const newScope = scope && ["tenant", "flavor", "platform"].includes(scope) ? scope : undefined;

    const { rows } = await pool.query(
      `UPDATE skills
       SET status = 'approved'${newScope ? ", scope = $2" : ""}
       WHERE id = $1 AND status = 'draft'
       RETURNING id, name, status, scope`,
      newScope ? [id, newScope] : [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Skill not found or not in draft status" });
    await logAdminEvent("skill_approved", undefined, { skill_id: id, scope: rows[0].scope });
    return res.json({ ok: true, skill: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/skills/:id/reject", async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE skills SET status = 'rejected'
       WHERE id = $1 AND status IN ('draft', 'submitted')
       RETURNING id, name, status`,
      [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Skill not found or already finalized" });
    await logAdminEvent("skill_rejected", undefined, { skill_id: id });
    return res.json({ ok: true, skill: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/skills/:id/promote", async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE skills SET status = 'platform', scope = 'platform', tenant_id = NULL
       WHERE id = $1 AND status = 'approved'
       RETURNING id, name, status, scope`,
      [id],
    );
    if (rows.length === 0) return res.status(404).json({ error: "Skill not found or not in approved status" });
    await logAdminEvent("skill_promoted", undefined, { skill_id: id });
    return res.json({ ok: true, skill: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.delete("/skills/:id", async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM skills WHERE id = $1", [id]);
    if (!rowCount) return res.status(404).json({ error: "Skill not found" });
    await logAdminEvent("skill_deleted", undefined, { skill_id: id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
