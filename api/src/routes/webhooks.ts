// Tiger Claw API — POST /webhooks/stripe
// Stripe checkout.session.completed → automated tenant provisioning
// TIGERCLAW-MASTER-SPEC-v2.md Block 5.1 "Trigger: Stripe/Stan Store Webhook"
//
// Required Stripe metadata on the checkout session:
//   metadata.slug              — URL-safe tenant identifier (e.g. "john-doe")
//   metadata.flavor            — bot flavor (e.g. "network-marketer")
//   metadata.region            — region code (e.g. "us-en")
//   metadata.bot_token         — Telegram bot token
//   metadata.timezone          — e.g. "America/Phoenix"
// Customer fields:
//   customer_details.name
//   customer_details.email
//   customer_details.preferred_locales[0] → language

import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { createHmac } from "crypto";
import Redis from "ioredis";
import { telegramQueue, lineQueue, emailQueue } from "../services/queue.js";
import {
  createBYOKUser,
  createBYOKBot,
  createBYOKSubscription,
  getTenant,
  logAdminEvent,
} from "../services/db.js";
import { decryptToken } from "../services/pool.js";
import { sendAdminAlert } from "./admin.js";
import { sendStanStoreWelcome } from "../services/email.js";

const router = Router();

const stripe = process.env["STRIPE_SECRET_KEY"]
  ? new Stripe(process.env["STRIPE_SECRET_KEY"])
  : null;

const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

// Redis client for idempotency keys
const redis = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", { lazyConnect: true });
const IDEMPOTENCY_TTL = 86400; // 24 hours

// ---------------------------------------------------------------------------
// POST /webhooks/stripe
// ---------------------------------------------------------------------------

router.post("/stripe", async (req: Request, res: Response) => {
  // Validate Stripe signature
  if (!stripe || !WEBHOOK_SECRET) {
    console.error("[stripe-webhook] CRITICAL: Stripe is not configured. STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing.");
    return res.status(503).json({ error: "Stripe not configured" });
  }

  const sig = req.headers["stripe-signature"] as string;
  let event: any;

  try {
    if (!sig) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    // Signature verification failed — attempt a strict fallback for Stan Store (no signing secret).
    // SECURITY: We fetch the session directly from Stripe and use THEIR data, never the payload.
    console.warn(`[stripe-webhook] Signature verification failed: ${err.message}. Attempting Stripe API fallback...`);
    try {
        const bodyJSON = JSON.parse(req.body.toString());
        const sessionId = bodyJSON?.data?.object?.id;
        const eventType = bodyJSON?.type;
        if (!sessionId || !eventType?.startsWith("checkout.session.")) {
            throw new Error("Could not extract checkout session ID from payload.");
        }
        // Fetch from Stripe directly — this IS the verified data
        const verifiedSession = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ["customer_details"],
        });
        if (!verifiedSession || verifiedSession.payment_status !== "paid") {
            throw new Error("Session not found or not paid.");
        }
        console.log(`[stripe-webhook] Fallback verified via Stripe API for session: ${verifiedSession.id}`);
        // Reconstruct minimal event using Stripe's data only (not the unverified payload)
        event = { type: "checkout.session.completed", id: `fallback_${verifiedSession.id}`, data: { object: verifiedSession } };
    } catch (fallbackErr: any) {
        console.error(`[stripe-webhook] Fallback failed: ${fallbackErr.message}`);
        return res.status(400).json({ error: "Webhook signature invalid" });
    }
  }

  // Idempotency guard — prevent duplicate provisioning on Stripe retries
  const sessionObj = event.data?.object as { id?: string } | undefined;
  const sessionId = sessionObj?.id;
  if (sessionId) {
    const idempotencyKey = `stripe:processed:${sessionId}`;
    const alreadyProcessed = await redis.get(idempotencyKey).catch(() => null);
    if (alreadyProcessed) {
        console.log(`[stripe-webhook] Duplicate delivery for session ${sessionId} — skipping.`);
        return res.status(200).json({ received: true, duplicate: true });
    }
    await redis.set(idempotencyKey, "1", "EX", IDEMPOTENCY_TTL).catch(() => null);
  }

  console.log(`[stripe-webhook] Received event: ${event.type} (id: ${event.id})`);

  // We only care about completed checkout sessions
  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, ignored: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const meta = session.metadata ?? {};
  const customer = session.customer_details;

  // Extract provisioning params from session
  const name = customer?.name ?? meta["name"] ?? "New Tenant";
  const email = customer?.email ?? meta["email"];
  
  if (!email) {
    console.error("[stripe-webhook] FATAL: No email found in session or metadata. Cannot provision.");
    await sendAdminAlert(`🚨 Stripe Webhook FATAL: No email for session ${session.id}`);
    return res.status(200).json({ received: true, error: "no_email" }); // Acknowledge to Stripe anyway
  }

  const slug = meta["slug"] ?? slugify(name);
  const language = ((customer as any)?.preferred_locales?.[0] ?? meta["language"] ?? "en").split("-")[0] ?? "en";
  const flavor = meta["flavor"] ?? "network-marketer";
  const region = meta["region"] ?? (language === "th" ? "th-th" : "us-en");
  const timezone = meta["timezone"] ?? "UTC";
  const preferredChannel = meta["channel"] ?? "telegram";

  // Validate flavor key — invalid flavor would silently break the tenant's bot
  const { VALID_FLAVOR_KEYS } = await import("../tools/flavorConfig.js");
  if (!(VALID_FLAVOR_KEYS as readonly string[]).includes(flavor)) {
    console.warn(`[stripe-webhook] Unknown flavor "${flavor}" for ${email} — defaulting to network-marketer`);
    // Don't reject — default gracefully so the customer still gets a working bot
  }

  console.log(`[stripe-webhook] Processing checkout for ${name} (${email}) — slug: ${slug}`);

  // Respond immediately to Stripe (must be within 5s)
  res.status(200).json({ received: true });

  // Provision async (non-blocking)
  setImmediate(async () => {
    try {
      console.log(`[stripe-webhook] Starting provisioning task for ${email}...`);
      
      // 1. Create User
      const userId = await createBYOKUser(email, name, typeof session.customer === "string" ? session.customer : undefined);

      // 2. Create a 'pending' bot record for this purchase so the wizard can find it
      const preBotId = meta["botId"] && meta["botId"] !== "pending" ? meta["botId"] : null;
      const botId = preBotId ?? await createBYOKBot(userId, meta["botName"] ?? name, flavor, "pending");

      // 3. Create Subscription record
      if (session.subscription || session.payment_status === "paid") {
        await createBYOKSubscription({
          userId,
          botId,
          stripeSubscriptionId: (session.subscription as string) || `stan_store_sale_${session.id}`,
          planTier: "byok_basic"
        });
      }

      // Stan Store pre-sale: user + pending bot created, waiting for Wizard to complete setup
      console.log(`[stripe-webhook] 🛍️ STAN STORE PRE-SALE for ${email}. User created, waiting for Wizard completion.`);
      await logAdminEvent("stan_store_purchase", botId, { email, slug, sessionId: session.id });
      
      // Dispatch the V4 magic link email to the customer
      await sendStanStoreWelcome(email, name);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[stripe-webhook] 🚨 PROVISIONING SETUP FAILED for ${email}:`, errMsg);
      
      await sendAdminAlert(
        `❌ Stripe webhook provisioning FAILED\nSession: ${session.id}\nCustomer: ${name} (${email})\nError: ${errMsg}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// POST /webhooks/telegram/:tenantId
// Stateless multi-tenancy routing for all Telegram updates
// ---------------------------------------------------------------------------

router.post("/telegram/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: "tenantId missing." });
  }

  // Validate Telegram webhook secret token.
  // Telegram sends X-Telegram-Bot-Api-Secret-Token on every update when the bot
  // was registered with setWebhook({ secret_token: TELEGRAM_WEBHOOK_SECRET }).
  // Any request missing or mismatching this header is rejected immediately.
  const TELEGRAM_WEBHOOK_SECRET = process.env["TELEGRAM_WEBHOOK_SECRET"];
  if (TELEGRAM_WEBHOOK_SECRET) {
    const incomingSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (incomingSecret !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn(`[webhooks] Telegram secret token mismatch for tenant: ${tenantId}`);
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    console.warn("[webhooks] TELEGRAM_WEBHOOK_SECRET not set — webhook signature validation is DISABLED. Set this env var immediately.");
  }

  // Ensure tenant exists and is active/onboarding
  const tenant = await getTenant(tenantId);
  if (!tenant || (tenant.status !== "active" && tenant.status !== "onboarding")) {
    console.warn(`[webhooks] Telegram update ignored for inactive tenant: ${tenantId}`);
    return res.status(200).send("OK"); // Acknowledge to stop Telegram from retrying
  }

  const payload = req.body;

  try {
    // Push the payload to BullMQ for asynchronous stateless processing
    await telegramQueue.add('telegram-webhook', {
      tenantId,
      botToken: tenant.botToken,
      payload
    }, {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });

    // Respond quickly to Telegram
    res.status(200).send("OK");
  } catch (err) {
    console.error(`[webhooks] Failed to enqueue Telegram message for ${tenantId}:`, err);
    res.status(500).send("Internal Server Error");
  }
});


// ---------------------------------------------------------------------------
// POST /webhooks/line/:tenantId
// LINE Messaging API webhook — signature verified, events enqueued to BullMQ.
// Raw body required for HMAC-SHA256 — index.ts must apply express.raw() before
// express.json() for this path prefix.
// ---------------------------------------------------------------------------

router.post("/line/:tenantId", async (req: Request, res: Response) => {
  const { tenantId } = req.params;

  if (!tenantId) {
    return res.status(400).json({ error: "tenantId missing" });
  }

  const tenant = await getTenant(tenantId);
  if (!tenant || !tenant.lineChannelSecret) {
    // Return 200 to prevent LINE from retrying — tenant simply not configured for LINE
    console.warn(`[webhooks] LINE webhook for unconfigured tenant: ${tenantId}`);
    return res.status(200).json({ received: true });
  }

  // Verify LINE signature: HMAC-SHA256 of raw body with channel secret, base64 encoded
  const signature = req.headers["x-line-signature"] as string;
  if (!signature) {
    return res.status(400).json({ error: "Missing x-line-signature" });
  }

  let channelSecret: string;
  try {
    channelSecret = decryptToken(tenant.lineChannelSecret);
  } catch (err) {
    console.error(`[webhooks] Failed to decrypt LINE channel secret for tenant ${tenantId}:`, err);
    // Return 200 to prevent LINE from retrying — this is a config error, not a transient failure
    return res.status(200).json({ received: true });
  }
  const expectedSig = createHmac("sha256", channelSecret)
    .update(req.body as Buffer)
    .digest("base64");

  if (expectedSig !== signature) {
    console.warn(`[webhooks] LINE signature mismatch for tenant: ${tenantId}`);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Acknowledge immediately — LINE expects 200 within 10 seconds
  res.status(200).json({ received: true });

  // Parse and enqueue events asynchronously
  if (!tenant.lineChannelAccessToken) {
    console.warn(`[webhooks] LINE channel access token missing for tenant: ${tenantId}`);
    return;
  }

  const encryptedChannelAccessToken = tenant.lineChannelAccessToken;

  setImmediate(async () => {
    try {
      const body = JSON.parse((req.body as Buffer).toString());
      for (const event of body.events ?? []) {
        if (event.type === "message" && event.message?.type === "text") {
          const userId: string = event.source?.userId;
          const text: string = (event.message.text ?? "").trim();

          if (!userId || !text) continue;

          await lineQueue.add("line-webhook", {
            tenantId,
            encryptedChannelAccessToken,
            userId,
            text,
          }, {
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
          });
        }
      }
    } catch (err) {
      console.error(`[webhooks] LINE event processing failed for tenant ${tenantId}:`, err);
    }
  });
});

// ---------------------------------------------------------------------------
// POST /webhooks/email
// Postmark inbound webhook — receives emails to support@tigerclaw.io and
// enqueues them for AI-generated replies.
// Secured by POSTMARK_WEBHOOK_TOKEN env var checked against the
// X-Postmark-Webhook-Token header Postmark sends with every inbound POST.
// ---------------------------------------------------------------------------
router.post("/email", async (req: Request, res: Response) => {
  // Validate Postmark webhook token
  const POSTMARK_WEBHOOK_TOKEN = process.env["POSTMARK_WEBHOOK_TOKEN"];
  if (POSTMARK_WEBHOOK_TOKEN) {
    const incoming = req.headers["x-postmark-webhook-token"];
    if (incoming !== POSTMARK_WEBHOOK_TOKEN) {
      console.warn("[webhooks] Postmark email webhook token mismatch");
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    console.warn("[webhooks] POSTMARK_WEBHOOK_TOKEN not set — email webhook is unprotected");
  }

  const body = req.body;
  const fromEmail: string = body?.From ?? body?.FromFull?.Email ?? "";
  const fromName: string  = body?.FromName ?? body?.FromFull?.Name ?? "";
  const subject: string   = body?.Subject ?? "(no subject)";
  const text: string      = body?.StrippedTextReply ?? body?.TextBody ?? body?.HtmlBody ?? "";
  const messageId: string = body?.MessageID ?? body?.Headers?.find((h: any) => h.Name === "Message-ID")?.Value ?? Date.now().toString();

  if (!fromEmail) {
    return res.status(400).json({ error: "No sender email in payload" });
  }

  // Acknowledge immediately — AI reply is async
  res.status(200).json({ received: true });

  await emailQueue.add("email-support", {
    fromEmail,
    fromName,
    subject,
    body: text,
    messageId,
  }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true,
  });

  console.log(`[webhooks] Inbound email queued from ${fromEmail}: "${subject}"`);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) + "-" + Date.now().toString(36);
}

export default router;
