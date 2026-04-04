// Tiger Claw API — TenantOrchestrator
// Express app on port 4000
// TIGERCLAW-MASTER-SPEC-v2.md Block 5.3 "Tiger Claw API (port 4000)"
//
// Routes mounted:
//   GET  /health
//   POST /webhooks/stripe
//   POST /admin/provision
//   GET  /admin/fleet
//   GET  /admin/fleet/:id
//   POST /admin/fleet/:id/report
//   POST /admin/fleet/:id/suspend
//   POST /admin/fleet/:id/resume
//   DELETE /admin/fleet/:id
//   GET  /admin/fleet/:id/logs
//   GET  /hive/patterns
//   POST /hive/patterns
//   PATCH /tenants/:id/status
//   POST  /tenants/:id/keys/activate
//   POST  /tenants/:id/scout
//
//   Every 30 seconds, performs a global health check of PostgreSQL and Redis.
//   Alert thresholds per Block 6.2.

import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";
loadSecrets(); // Inject volume-mounted secrets before anything else

import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { initSchema, listTenants, updateTenantStatus, logAdminEvent, fixBotPoolOrphans } from "./services/db.js";
import { initMarketIntelSchema } from "./services/market_intel.js";
import { runMigrations } from "./services/migrate.js";
import { getPoolStatus } from "./services/pool.js";
import { sendAdminAlert } from "./routes/admin.js";
import healthRouter from "./routes/health.js";
import authRouter from "./routes/auth.js";
import webhooksRouter from "./routes/webhooks.js";
import adminRouter from "./routes/admin.js";
import opsRouter from "./routes/ops.js";
import hiveRouter from "./routes/hive.js";
import tenantsRouter from "./routes/tenants.js";
import wizardRouter from "./routes/wizard.js";
import keysRouter from "./routes/keys.js";
import subscriptionsRouter from "./routes/subscriptions.js";
import dashboardRouter from "./routes/dashboard.js";
import miningRouter from "./routes/mining.js";
import flavorsRouter from "./routes/flavors.js";
import { validateAllFlavors } from "./tools/flavorConfig.js";
import "./services/queue.js"; // Initialize BullMQ Background Workers
import { connection as redisConnection } from "./services/queue.js";

const app = express();
const PORT = Number(process.env["PORT"] ?? 4000);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS — must be before raw body parsers so preflight OPTIONS requests are handled
// Public routes: reflect origin (stateless Bearer tokens, no cookies = no CSRF risk).
// /admin routes: locked to the wizard origin only.
const WIZARD_ORIGIN = process.env["WIZARD_ORIGIN"] ?? "https://wizard.tigerclaw.io";
app.use("/admin", cors({
  origin: WIZARD_ORIGIN,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Trust proxy required for Google Cloud Run
app.set("trust proxy", 1);

// Rate Limiting (SWOP Remediation)
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true }
});
app.use("/wizard", strictLimiter);
app.use("/webhooks", strictLimiter);

// Stripe requires raw body for signature verification
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));

// LINE requires raw body for HMAC-SHA256 signature verification
app.use("/webhooks/line", express.raw({ type: "application/json" }));

// Everything else gets JSON
app.use(express.json());

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/webhooks/ops", opsRouter); // Ops bot intercepts here specifically
app.use("/webhooks", webhooksRouter); // Stripe, LINE, and Tenant Telegrams
app.use("/admin", adminRouter);
app.use("/hive", hiveRouter);
app.use("/tenants", tenantsRouter);
app.use("/wizard", wizardRouter);
app.use("/keys", keysRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/dashboard", dashboardRouter);
app.use("/mining", miningRouter);
app.use("/flavors", flavorsRouter);

// ── GET /go/:code — magic link short redirect ─────────────────────────────────
app.get("/go/:code", async (req: Request, res: Response) => {
  const { code } = req.params;
  const url = await redisConnection.get(`magic_short:${code}`);
  if (!url) return res.status(410).send("This link has expired or is invalid.");
  return res.redirect(302, url);
});

// Root ping
app.get("/", (_req: Request, res: Response) => {
  res.json({ service: "tiger-claw-api", version: "2.0.0" });
});

// 404
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global async error handler — catches unhandled promise rejections from Express 4 routes
// Express 4 does not forward async errors automatically; this catches them via next(err)
// and also acts as a safety net for any route that forgets try-catch.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[tiger-claw-api] Unhandled route error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "internal_server_error" });
  }
});

// ---------------------------------------------------------------------------
// 30-second fleet health monitor
// TIGERCLAW-MASTER-SPEC-v2.md Block 6.2
// ---------------------------------------------------------------------------

// Track consecutive failures per slug
const failureCount: Record<string, number> = {};
const ALERT_THRESHOLD = {
  MEMORY_WARN: 80,   // %
  MEMORY_CRIT: 95,   // % → restart
  FAIL_WARN: 1,
  FAIL_CRIT: 3,      // → auto-restart
  ACTIVITY_WARN_H: 24,  // hours → flag as potentially churned
  ACTIVITY_CRIT_H: 72,  // hours → critical churn flag
  DISK_WARN: 80,     // %
  DISK_CRIT: 95,     // % → alert, run cleanup
};

// Alert dedup: only alert once per hour per tenant per condition.
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const lastKeyLayerAlert: Record<string, { layer: number; alertedAt: number }> = {};
const lastActivityAlert: Record<string, { level: string; alertedAt: number }> = {};
const lastDiskAlert: { level: string; alertedAt: number } = { level: "ok", alertedAt: 0 };
let lastAdminBotHealth: { ok: boolean; alertedAt: number } = { ok: true, alertedAt: 0 };

async function runHealthMonitor(): Promise<void> {
  // Admin Bot Heartbeat — Block 6.2 extension
  try {
    const now = Date.now();
    const token = process.env["ADMIN_TELEGRAM_BOT_TOKEN"];
    if (token) {
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json() as { ok: boolean };
      if (!data.ok) {
        if (lastAdminBotHealth.ok || (now - lastAdminBotHealth.alertedAt) > ALERT_COOLDOWN_MS) {
          console.error("[monitor] 🚨 Admin Bot Token is EXPIRED or INVALID (401/403)");
          lastAdminBotHealth = { ok: false, alertedAt: now };
          await logAdminEvent("nervous_system_failure", "system", { error: "Admin token 401/403" }).catch(() => {});
        }
      } else {
        lastAdminBotHealth = { ok: true, alertedAt: now };
      }
    }
  } catch (err) {
    // Non-fatal — network glitch
  }

  // Disk usage check — Block 6.2 threshold
  try {
    const { execSync } = await import("child_process");
    const dfOutput = execSync("df -P /", {
      encoding: "utf8",
    });
    const lines = dfOutput.trim().split("\n");
    if (lines.length >= 2) {
      const parts = lines[1]!.split(/\s+/);
      const usageStr = parts[4]?.replace("%", "");
      const usage = usageStr ? parseInt(usageStr, 10) : 0;
      const now = Date.now();
      const cooldownOk = (now - lastDiskAlert.alertedAt) > ALERT_COOLDOWN_MS;

      if (usage >= ALERT_THRESHOLD.DISK_CRIT && cooldownOk) {
        lastDiskAlert.level = "critical";
        lastDiskAlert.alertedAt = now;
        await sendAdminAlert(
          `🚨 Disk usage at ${usage}% — run cleanup immediately`
        );
      } else if (usage >= ALERT_THRESHOLD.DISK_WARN && cooldownOk) {
        lastDiskAlert.level = "warning";
        lastDiskAlert.alertedAt = now;
        await sendAdminAlert(
          `⚠️ Disk usage at ${usage}% (threshold: ${ALERT_THRESHOLD.DISK_WARN}%)`
        );
      }
    }
  } catch {
    // Non-fatal — disk check is best-effort
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Run versioned SQL migrations first (GAP-8 — must run before schema init)
  await runMigrations();

  // Initialize PostgreSQL schema (legacy CREATE TABLE IF NOT EXISTS fallback)
  await initSchema();

  // Initialize Market Intelligence schema (v5 Data Moat)
  await initMarketIntelSchema();

  // Recover orphaned bot pool entries (assigned rows with no tenant after hard-delete)
  await fixBotPoolOrphans().catch((err) => console.warn("[startup] fixBotPoolOrphans failed (non-fatal):", err.message));

  // Validate all 11 flavor JSON files (GAP 1)
  validateAllFlavors();

  // Start HTTP server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[tiger-claw-api] Listening on 0.0.0.0 port ${PORT}`);
  });

  // Start fleet health monitor (30-second interval)
  setInterval(runHealthMonitor, 30_000);
  console.log("[monitor] Fleet health monitor started (30s interval)");
}

// Prevent async route errors from crashing the process.
// Express 4 async handlers that throw without calling next(err) produce unhandled rejections.
// Log loudly but keep the server alive — the individual request will hang unless
// the route also has its own try-catch to send a response.
process.on("unhandledRejection", (reason) => {
  console.error("[tiger-claw-api] UNHANDLED PROMISE REJECTION:", reason);
});

main().catch((err) => {
  console.error("[tiger-claw-api] Fatal startup error:", err);
  process.exit(1);
});
