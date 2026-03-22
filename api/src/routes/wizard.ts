// Tiger Claw — Channel Wizard Routes
// TIGERCLAW-BLUEPRINT-v3.md §5, TIGERCLAW-PRD-v3.md FR-CW-2, FR-CW-3
//
// Serves a plain HTML page (no framework) at /wizard/:slug for tenant
// channel configuration (Telegram, WhatsApp, LINE).
//
// Endpoints:
//   GET  /wizard/:slug       — serve wizard HTML page
//   POST /wizard/:slug/save  — save channel config changes

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import {
  getTenantBySlug,
  getTenantByEmail,
  getTenantBotUsername,
  updateTenantChannelConfig,
  upsertBYOKConfig,
  addAIKey,
  importContacts,
  getFoundingMemberDisplay,
} from "../services/db.js";
import { encryptToken } from "../services/pool.js";
import { provisionQueue } from "../services/queue.js";
import { z } from "zod";

const router = Router();

const ImportContactsSchema = z.object({
  tenantId: z.string(),
  contacts: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional()
  })).min(1)
});

const HatchSchema = z.object({
  botId: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  flavor: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  preferredChannel: z.string().optional(),
  region: z.string().optional(),
  hiveOptIn: z.boolean().optional()
});

const ValidateKeySchema = z.object({
  botId: z.string(),
  keys: z.array(z.object({
    provider: z.string(),
    key: z.string(),
    model: z.string()
  })).min(1)
});

const stripe = process.env["STRIPE_SECRET_KEY"]
  ? new Stripe(process.env["STRIPE_SECRET_KEY"])
  : null;

// ── POST /wizard/import-contacts ─────────────────────────────────────────────
// Hunter Framework: Import Circle of Influence contacts during onboarding.
router.post("/import-contacts", async (req: Request, res: Response) => {
  const parsed = ImportContactsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload.", details: parsed.error.format() });
  }
  const { tenantId, contacts } = parsed.data;

  try {
    const count = await importContacts(tenantId, contacts);
    console.log(`[wizard] Imported ${count} contacts for tenant ${tenantId}`);
    return res.json({ ok: true, count });
  } catch (err: any) {
    console.error(`[wizard] Failed to import contacts:`, err.message);
    return res.status(500).json({ error: "Failed to import contacts." });
  }
});

// ── GET /wizard/auth ─────────────────────────────────────────────────────────
// Authenticates a user returning from Stan Store via the magic email link.
// Verifies they have a paid subscription/bot before letting them run the wizard.
router.get("/auth", async (req: Request, res: Response) => {
  const email = req.query["email"] as string | undefined;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const tenant = await getTenantByEmail(email);
    if (!tenant) {
      return res.status(404).json({ error: "No purchase found for this email." });
    }

    // Return the botId so the React wizard can attach AI keys to it
    // In the new architecture, tenant.id is actually the botId when migrating to V4 DB
    return res.json({
      ok: true,
      botId: tenant.id,
      name: tenant.name,
      status: tenant.status
    });
  } catch (err: any) {
    console.error("[wizard] Auth error:", err);
    return res.status(500).json({ error: "Authentication failed." });
  }
});

// ── POST /wizard/hatch ───────────────────────────────────────────────────────
// The capstone of the Stan Store flow. Extracts completed Wizard Config and 
// enqueues the actual Agent Provisioning process.
router.post("/hatch", async (req: Request, res: Response) => {
  const parsed = HatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload.", details: parsed.error.format() });
  }
  const { botId, name, email, flavor, language, timezone, preferredChannel, region, hiveOptIn } = parsed.data;

  try {
    const tenant = await getTenantByEmail(email);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const slug = tenant.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    const finalRegion = region || (language === "th" ? "th-th" : "us-en");

    // Enqueue the heavy lifting
    await provisionQueue.add('tenant-provisioning', {
      userId: tenant.id, // Assuming legacy map
      botId: botId,
      slug,
      name: name || tenant.name,
      email,
      flavor: flavor || "network-marketer",
      region: finalRegion,
      language: language || "en",
      preferredChannel: preferredChannel || "telegram",
      timezone: timezone || "UTC",
      hiveOptIn: hiveOptIn ?? true
    }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
    });

    console.log(`[wizard] 🚀 Agent Hatch triggered for ${email} (Bot: ${botId})`);
    return res.json({ ok: true, message: "Hatch sequence initiated." });
  } catch (err: any) {
    console.error("[wizard] Hatch compilation failed:", err);
    return res.status(500).json({ error: "Failed to initiate hatch sequence." });
  }
});
// Polled by PostPaymentSuccess after Stripe redirect.
// Returns provisioning status so the UI can show "live" when the bot is ready.

router.get("/status", async (req: Request, res: Response) => {
  const sessionId = req.query["session_id"] as string | undefined;
  if (!sessionId) {
    return res.status(400).json({ error: "session_id is required" });
  }

  // Retrieve session from Stripe to get the customer's email
  if (!stripe) {
    return res.status(503).json({ error: "Stripe not configured" });
  }

  let customerEmail: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    customerEmail = session.customer_details?.email ?? null;
  } catch (err) {
    console.error("[wizard] Failed to retrieve Stripe session:", err);
    return res.json({ status: "error", error: "Invalid session_id" });
  }

  if (!customerEmail) {
    return res.json({ status: "pending", botUsername: null, telegramLink: null });
  }

  // Look up tenant by email
  const tenant = await getTenantByEmail(customerEmail);
  if (!tenant || tenant.status === "pending") {
    return res.json({ status: "pending", botUsername: null, telegramLink: null });
  }

  const botUsername = await getTenantBotUsername(tenant.id);
  const isLive = tenant.status === "active" || tenant.status === "onboarding";

  return res.json({
    status: isLive ? "live" : "pending",
    botUsername: botUsername ?? null,
    telegramLink: botUsername ? `https://t.me/${botUsername}` : null,
    tenantSlug: tenant.slug,
    tenantId: tenant.id,
  });
});

// ── POST /wizard/validate-key ────────────────────────────────────────────────
// GAP 7 — Server-side BYOK key validation + 4-Key Rotation
// Accepts: { botId: "<uuid>", keys: [{ provider: "google", key: "AIza...", model: "..." }] }
// Validates each key, then encrypts and stores them in bot_ai_keys.

router.post("/validate-key", async (req: Request, res: Response) => {
  const parsed = ValidateKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ valid: false, error: "Invalid payload format.", details: parsed.error.format() });
  }
  const { botId, keys } = parsed.data;

  const results: any[] = [];

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    console.log(`[wizard] Validating ${k.provider} key for bot ${botId}...`);

    try {
      let isValid = false;

      // Provider-specific validation logic
      if (k.provider === "google") {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k.key)}`;
        const response = await fetch(testUrl);
        isValid = response.ok;
      } else if (k.provider === "openai") {
        const response = await fetch("https://api.openai.com/v1/models", {
          headers: { "Authorization": `Bearer ${k.key}` }
        });
        isValid = response.ok;
      } else {
        // Fallback for other providers: assume valid if format is correct
        isValid = k.key.length > 10;
      }

      if (isValid) {
        const encrypted = encryptToken(k.key);
        const preview = `${k.key.slice(0, 4)}...${k.key.slice(-4)}`;

        // 1. Store in the new Multi-Key table
        await addAIKey({
          botId,
          provider: k.provider,
          model: k.model,
          encryptedKey: encrypted,
          keyPreview: preview,
          priority: i,
        });

        // 2. Backward compatibility: Store the first key in the legacy bot_ai_config
        if (i === 0) {
          await upsertBYOKConfig({
            botId,
            connectionType: "byok",
            provider: k.provider,
            model: k.model,
            encryptedKey: encrypted,
            keyPreview: preview,
          });
        }

        results.push({ provider: k.provider, status: "success" });
      } else {
        results.push({ provider: k.provider, status: "error", error: "Validation failed" });
      }
    } catch (err: any) {
      results.push({ provider: k.provider, status: "error", error: err.message });
    }
  }

  const allValid = results.every(r => r.status === "success");
  return res.json({
    valid: allValid,
    details: results
  });
});

// ── GET /wizard/:slug ────────────────────────────────────────────────────────

router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const slug = req.params["slug"]!;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return res.status(404).send("Tenant not found.");
    }

    const botUsername = await getTenantBotUsername(tenant.id);
    const rawFounder = await getFoundingMemberDisplay(tenant.id).catch(() => null);
    
    let founderDisplay: any = null;
    if (rawFounder && rawFounder.isFounding) {
      founderDisplay = {
        title: "Founding Member",
        badge: "✨",
        description: `You are Founding Member #${rawFounder.rank} of ${rawFounder.totalFoundersInVertical} in the ${rawFounder.vertical} vertical. Thank you for anchoring the Hive.`
      };
    }

    // Never send LINE credentials back to the browser — show configured/not status only
    const html = renderWizardPage({
      slug: tenant.slug,
      name: tenant.name,
      botUsername,
      whatsappEnabled: tenant.whatsappEnabled,
      lineConfigured: !!(tenant.lineChannelSecret && tenant.lineChannelAccessToken),
      founderDisplay,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  } catch (err) {
    console.error("[wizard] GET /:slug error:", err);
    return res.status(500).send("Internal server error.");
  }
});

// ── POST /wizard/:slug/save ──────────────────────────────────────────────────

router.post("/:slug/save", async (req: Request, res: Response) => {
  try {
    const slug = req.params["slug"]!;
    const tenant = await getTenantBySlug(slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found." });
    }

    const { whatsappEnabled, lineChannelSecret, lineChannelAccessToken } = req.body as {
      whatsappEnabled?: boolean;
      lineChannelSecret?: string;
      lineChannelAccessToken?: string;
    };

    if (lineChannelSecret !== undefined && lineChannelSecret !== "") {
      if (typeof lineChannelSecret !== "string" || lineChannelSecret.length > 200) {
        return res.status(400).json({ error: "LINE channel secret must be 200 characters or fewer." });
      }
    }
    if (lineChannelAccessToken !== undefined && lineChannelAccessToken !== "") {
      if (typeof lineChannelAccessToken !== "string" || lineChannelAccessToken.length > 200) {
        return res.status(400).json({ error: "LINE channel access token must be 200 characters or fewer." });
      }
    }

    // Encrypt LINE credentials before storage (AES-256-GCM — same as BYOK keys)
    // NEVER store plaintext LINE credentials in the database.
    let finalEncryptedSecret;
    let finalEncryptedToken;
    try {
      finalEncryptedSecret = lineChannelSecret
        ? (lineChannelSecret === "" ? null : encryptToken(lineChannelSecret))
        : undefined;
      finalEncryptedToken = lineChannelAccessToken
        ? (lineChannelAccessToken === "" ? null : encryptToken(lineChannelAccessToken))
        : undefined;
    } catch (err) {
      return res.status(500).json({ error: "Encryption error" });
    }

    await updateTenantChannelConfig(tenant.id, {
      whatsappEnabled: whatsappEnabled ?? undefined,
      lineChannelSecret: lineChannelSecret === "" ? null : finalEncryptedSecret,
      lineChannelAccessToken: lineChannelAccessToken === "" ? null : finalEncryptedToken,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[wizard] POST /:slug/save error:", err);
    return res.status(500).json({ error: "Failed to save channel configuration." });
  }
});

// ── HTML renderer ────────────────────────────────────────────────────────────

interface WizardData {
  slug: string;
  name: string;
  botUsername: string | null;
  whatsappEnabled: boolean;
  lineConfigured: boolean; // true if both LINE credentials are stored — never expose the values
  founderDisplay?: { title: string; badge: string; description: string } | null;
}

function renderWizardPage(data: WizardData): string {
  const telegramStatus = data.botUsername
    ? `<span class="status active">Active</span> — <a href="https://t.me/${esc(data.botUsername)}" target="_blank" class="accent-link">@${esc(data.botUsername)}</a>`
    : `<span class="status pending">Pending</span> — token assignment in progress`;

  const waChecked = data.whatsappEnabled ? "checked" : "";
  const waStatus = data.whatsappEnabled
    ? `<span class="status active">Enabled</span>`
    : `<span class="status off">Disabled</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Channel Configuration &middot; ${esc(data.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-dark: #0a0a0c;
    --card-bg: rgba(22, 27, 34, 0.6);
    --card-border: rgba(255, 255, 255, 0.08);
    --text-main: #f0f3f6;
    --text-muted: #8b949e;
    --accent: #58a6ff;
    --accent-hover: #79c0ff;
    --success: #3fb950;
    --success-bg: rgba(63, 185, 80, 0.15);
    --warning: #d29922;
    --warning-bg: rgba(210, 153, 34, 0.15);
    --danger: #f85149;
    --danger-bg: rgba(248, 81, 73, 0.15);
    --input-bg: #0d1117;
    --btn-primary: #238636;
    --btn-hover: #2ea043;
  }
  
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'Inter', sans-serif; 
    background: radial-gradient(circle at top center, #1b212c 0%, var(--bg-dark) 40%); 
    background-attachment: fixed;
    color: var(--text-main); 
    line-height: 1.6; 
    padding: 3rem 1rem; 
    -webkit-font-smoothing: antialiased;
  }
  
  .container { max-width: 600px; margin: 0 auto; }
  
  header { margin-bottom: 2.5rem; text-align: center; }
  h1 { font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
  .subtitle { color: var(--text-muted); font-size: 0.95rem; }
  
  .card { 
    background: var(--card-bg); 
    border: 1px solid var(--card-border); 
    border-radius: 12px; 
    padding: 1.75rem; 
    margin-bottom: 1.25rem; 
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .card:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); border-color: rgba(255, 255, 255, 0.12); }
  
  .card h2 { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.6rem; }
  .card p { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; }
  
  .status { display: inline-flex; align-items: center; padding: 0.15rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; border: 1px solid transparent; }
  .status.active { background: var(--success-bg); color: var(--success); border-color: rgba(63, 185, 80, 0.3); }
  .status.pending { background: var(--warning-bg); color: var(--warning); border-color: rgba(210, 153, 34, 0.3); }
  .status.off { background: rgba(139, 148, 158, 0.1); color: var(--text-muted); border-color: rgba(139, 148, 158, 0.2); }
  
  a.accent-link { color: var(--accent); text-decoration: none; font-weight: 500; transition: color 0.15s ease; }
  a.accent-link:hover { color: var(--accent-hover); text-decoration: underline; }
  
  label { display: block; font-size: 0.85rem; font-weight: 500; margin-bottom: 0.5rem; color: #c9d1d9; }
  
  input[type="text"] { 
    width: 100%; 
    padding: 0.6rem 0.85rem; 
    background: var(--input-bg); 
    border: 1px solid var(--card-border); 
    border-radius: 8px; 
    color: var(--text-main); 
    font-size: 0.9rem; 
    font-family: 'Inter', monospace;
    transition: all 0.2s ease;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
  }
  input[type="text"]:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88,166,255,0.2), inset 0 2px 4px rgba(0,0,0,0.2); }
  input[type="text"][readonly] { cursor: pointer; }
  
  .toggle-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle .slider { position: absolute; inset: 0; background: rgba(255,255,255,0.1); border-radius: 12px; cursor: pointer; transition: background 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2); }
  .toggle .slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; bottom: 3px; background: #fff; border-radius: 50%; transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  .toggle input:checked + .slider { background: var(--btn-primary); }
  .toggle input:checked + .slider::before { transform: translateX(20px); }
  
  .details { overflow: hidden; max-height: 0; opacity: 0; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; }
  .details.open { max-height: 250px; opacity: 1; margin-top: 1rem; }
  
  .instruction-guide { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.05); }
  .instruction-guide ol { padding-left: 1.5rem; color: var(--text-muted); }
  .instruction-guide li { margin-bottom: 0.4rem; }
  
  .action-bar { display: flex; justify-content: flex-end; align-items: center; margin-top: 2rem; gap: 1rem; }
  
  .btn { 
    display: inline-flex; 
    align-items: center; 
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6rem 1.5rem; 
    background: var(--btn-primary); 
    color: #fff; 
    border: 1px solid rgba(255,255,255,0.1); 
    border-radius: 8px; 
    font-size: 0.95rem; 
    font-weight: 500; 
    cursor: pointer; 
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(35, 134, 54, 0.2);
  }
  .btn:hover:not(:disabled) { background: var(--btn-hover); box-shadow: 0 6px 16px rgba(35, 134, 54, 0.3); transform: translateY(-1px); }
  .btn:disabled { background: rgba(255,255,255,0.1); color: var(--text-muted); cursor: not-allowed; box-shadow: none; border-color: transparent; }
  
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: none;
  }
  .btn.saving .spinner { display: inline-block; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  
  /* Toast Notification */
  .toast-container {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    backdrop-filter: blur(12px);
    padding: 12px 24px;
    border-radius: 30px;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
    pointer-events: none;
    z-index: 1000;
  }
  .toast-container.show {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
  .toast-container.success { border-bottom: 2px solid var(--success); }
  .toast-container.error { border-bottom: 2px solid var(--danger); }
  .toast-icon { font-size: 1.1rem; }
  
  details summary { cursor: pointer; color: var(--accent); font-size: 0.85rem; font-weight: 500; outline: none; user-select: none; transition: color 0.2s; }
  details summary:hover { color: var(--accent-hover); }
  details summary::marker { color: var(--text-muted); }
</style>
</head>
<body>

<div class="toast-container" id="toast">
  <span class="toast-icon" id="toast-icon">✅</span>
  <span id="toast-msg">Settings saved successfully.</span>
</div>

<div class="container">
  <header>
    <h1>Agent Configuration</h1>
    <p class="subtitle">${esc(data.name)} &middot; ${esc(data.slug)}</p>
  </header>

  <!-- Telegram -->
  <div class="card">
    <h2><span style="font-size:1.3rem;">✈️</span> Telegram</h2>
    <p>Your primary, always-on AI responder channel.</p>
    <div style="margin-top: 0.5rem;">${telegramStatus}</div>
  </div>

  <!-- WhatsApp -->
  <div class="card">
    <h2><span style="font-size:1.3rem;">💬</span> WhatsApp</h2>
    <p>Optional outreach channel linked via WhatsApp Web Session. ${waStatus}</p>
    
    <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); margin-top: 1rem;">
      <div class="toggle-row">
        <label class="toggle">
          <input type="checkbox" id="wa-toggle" ${waChecked}>
          <span class="slider"></span>
        </label>
        <span id="wa-label" style="font-weight: 500;">${data.whatsappEnabled ? "Channel Enabled" : "Channel Disabled"}</span>
      </div>
      <div class="details${data.whatsappEnabled ? " open" : ""}" id="wa-details">
        <p style="margin-bottom:0; color:var(--text-muted); font-size: 0.85rem;">When enabled, your active bot will transmit a secure QR code into your primary Telegram chat. Scan it using your physical WhatsApp mobile app to authorize the agent terminal. Sessions strictly persist across microservice restarts.</p>
      </div>
    </div>
  </div>

  ${data.founderDisplay ? `
  <!-- Hive Phase 4: Founding Member Achievement -->
  <div class="card" style="border: 1px solid var(--accent); background: rgba(88, 166, 255, 0.05);">
    <h2><span style="font-size:1.3rem;">👑</span> ${data.founderDisplay.title}</h2>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem;">
      <p style="margin: 0;">${data.founderDisplay.description}</p>
      <span style="font-size:2.5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">${data.founderDisplay.badge}</span>
    </div>
  </div>
  ` : ''}

  <!-- LINE -->
  <div class="card">
    <h2><span style="font-size:1.3rem;">🟢</span> LINE Messenger</h2>
    <p>Optional regional outreach channel. ${data.lineConfigured ? '<span class="status active">Secured</span>' : '<span class="status off">Not Configured</span>'}</p>
    
    <div class="instruction-guide">
      <details>
        <summary>View Official LINE Integration Guide</summary>
        <div style="margin-top: 0.75rem;">
          <ol>
            <li>Navigate to the <a href="https://developers.line.biz/" target="_blank" class="accent-link">LINE Developer Console</a> and authenticate.</li>
            <li>Construct a new <strong>Provider</strong>, followed by a <strong>Messaging API</strong> Application.</li>
            <li>Under <strong>Basic Settings</strong>, copy your <strong>Channel Secret</strong>.</li>
            <li>Under <strong>Messaging API</strong>, generate and copy your <strong>Channel Access Token</strong>.</li>
            <li>Paste the explicit cryptographic values below. They will be AES-256 encrypted centrally.</li>
          </ol>
        </div>
      </details>
    </div>
    
    <!-- HARDENED INPUTS: Password Manager Bypass via readonly switch and anti-fill attributes -->
    <label for="line-secret">Channel Secret 🔒</label>
    <input type="text" id="line-secret" 
      placeholder="${data.lineConfigured ? "Encrypted Vault (Leave blank to keep)" : "Paste your LINE channel secret"}" 
      maxlength="200" 
      data-lpignore="true" autocomplete="new-password" spellcheck="false" 
      readonly onfocus="this.removeAttribute('readonly')"
      style="margin-bottom:1.25rem;">
      
    <label for="line-access-token">Channel Access Token 🔒</label>
    <input type="text" id="line-access-token" 
      placeholder="${data.lineConfigured ? "Encrypted Vault (Leave blank to keep)" : "Paste your LINE channel access token"}" 
      maxlength="200"
      data-lpignore="true" autocomplete="new-password" spellcheck="false" 
      readonly onfocus="this.removeAttribute('readonly')">
  </div>

  <div class="action-bar">
    <button class="btn" id="save-btn" onclick="saveConfig()">
      <span class="spinner"></span>
      <span id="btn-text">Synchronize Configuration</span>
    </button>
  </div>
</div>

<script>
  const waToggle = document.getElementById("wa-toggle");
  const waDetails = document.getElementById("wa-details");
  const waLabel = document.getElementById("wa-label");
  const btn = document.getElementById("save-btn");
  const btnText = document.getElementById("btn-text");
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toast-icon");
  const toastMsg = document.getElementById("toast-msg");
  
  let toastTimeout;

  function showToast(message, type) {
    clearTimeout(toastTimeout);
    toastMsg.textContent = message;
    
    if (type === 'success') {
      toast.className = "toast-container success show";
      toastIcon.textContent = "✅";
    } else {
      toast.className = "toast-container error show";
      toastIcon.textContent = "❌";
    }
    
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 4000);
  }

  waToggle.addEventListener("change", function() {
    if (this.checked) {
      waDetails.classList.add("open");
      waLabel.textContent = "Channel Enabled";
    } else {
      waDetails.classList.remove("open");
      waLabel.textContent = "Channel Disabled";
    }
  });

  function saveConfig() {
    btn.disabled = true;
    btn.classList.add("saving");
    btnText.textContent = "Encrypting...";

    const body = {
      whatsappEnabled: waToggle.checked,
      lineChannelSecret: document.getElementById("line-secret").value.trim(),
      lineChannelAccessToken: document.getElementById("line-access-token").value.trim()
    };

    fetch("/wizard/${esc(data.slug)}/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(r => r.json())
    .then(d => {
      btn.disabled = false;
      btn.classList.remove("saving");
      btnText.textContent = "Synchronize Configuration";
      
      if (d.ok) {
        showToast("Configuration encrypted and synchronized successfully.", "success");
        // Clear inputs as they are now securely stored
        document.getElementById("line-secret").value = "";
        document.getElementById("line-access-token").value = "";
        document.getElementById("line-secret").placeholder = "Encrypted Vault (Leave blank to keep)";
        document.getElementById("line-access-token").placeholder = "Encrypted Vault (Leave blank to keep)";
        // Update LINE status pill locally if they just provided the keys
        if (body.lineChannelSecret && body.lineChannelAccessToken) {
           const lineStatusPill = document.querySelector('.card:nth-of-type(3) p .status');
           if (lineStatusPill) {
             lineStatusPill.className = "status active";
             lineStatusPill.textContent = "Secured";
           }
        }
      } else {
        showToast(d.error || "Failed to synchronize configuration.", "error");
      }
    })
    .catch(e => {
      btn.disabled = false;
      btn.classList.remove("saving");
      btnText.textContent = "Synchronize Configuration";
      showToast("Network execution error: " + e.message, "error");
    });
  }
</script>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default router;
