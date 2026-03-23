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
import { provisionQueue, telegramQueue, lineQueue } from "../services/queue.js";
import {
  createBYOKUser,
  createBYOKBot,
  createBYOKConfig,
  createBYOKSubscription,
  getTenant,
  logAdminEvent,
  getPool,
  getBotState,
  setBotState,
} from "../services/db.js";
import { decryptToken } from "../services/pool.js";
import { sendAdminAlert } from "./admin.js";
import { sendStanStoreWelcome } from "../services/email.js";

const router = Router();

const stripe = process.env["STRIPE_SECRET_KEY"]
  ? new Stripe(process.env["STRIPE_SECRET_KEY"])
  : null;

const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

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
    console.warn(`[stripe-webhook] Signature verification failed: ${err.message}. Attempting direct Stripe API verification fallback...`);
    try {
        const bodyJSON = JSON.parse(req.body.toString());
        if (bodyJSON.data?.object?.id && bodyJSON.type) {
            
            // Only strictly verify 'checkout.session' objects
            if (bodyJSON.type.startsWith('checkout.session.')) {
                const verifiedSession = await stripe.checkout.sessions.retrieve(bodyJSON.data.object.id);
                if (verifiedSession && verifiedSession.payment_status === 'paid') {
                    console.log(`[stripe-webhook] Fallback check SUCCESS for session: ${verifiedSession.id}`);
                    event = bodyJSON;
                } else {
                    throw new Error("Session invalid or not paid.");
                }
            } else {
                throw new Error("Only checkouts support fallback verification.");
            }
        } else {
            throw new Error("Could not parse payload for fallback verification.");
        }
    } catch (fallbackErr: any) {
        console.error(`[stripe-webhook] Fallback verification failed: ${fallbackErr.message}`);
        return res.status(400).json({ error: "Invalid signature and fallback verification failed" });
    }
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

  console.log(`[stripe-webhook] Processing checkout for ${name} (${email}) — slug: ${slug}`);

  // Respond immediately to Stripe (must be within 5s)
  res.status(200).json({ received: true });

  // Provision async (non-blocking)
  setImmediate(async () => {
    try {
      console.log(`[stripe-webhook] Starting provisioning task for ${email}...`);
      
      // 1. Create User
      const userId = await createBYOKUser(email, name, typeof session.customer === "string" ? session.customer : undefined);

      // Trial-to-paid conversion check!
      const pool = getPool();
      const existingBotRes = await pool.query(
        "SELECT id FROM bots WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [userId]
      );
      
      let botId;
      let preBotId = meta["botId"] && meta["botId"] !== "pending" ? meta["botId"] : null;
      let isTrialConversion = false;

      if (existingBotRes.rows.length > 0) {
        // This user already has a bot — unlock it
        botId = existingBotRes.rows[0].id;
        const botState = JSON.parse(await getBotState(botId, "key_state.json") || "{}");
        
        if (botState.tenantPaused) {
            botState.tenantPaused = false;
            await setBotState(botId, "key_state.json", botState);
            isTrialConversion = true;
            
            await pool.query("UPDATE bots SET status = 'live' WHERE id = $1", [botId]);
            await pool.query("UPDATE tenants SET status = 'active' WHERE id = $1", [botId]);
            
            console.log(`[stripe-webhook] 🔓 Trial-to-paid conversion! Unlocked bot ${botId}`);
            await logAdminEvent("trial_conversion_unlock", botId, { email, sessionId: session.id });
        }
      } else {
        // 2. Identify Bot record (pre-registered vs new)
        // Stan Store purchases don't have a preBotId, so we create a blank 'pending' bot here
        botId = preBotId ?? await createBYOKBot(userId, meta["botName"] ?? name, flavor, "pending");
      }

      // 3. Create AI Config only if no pre-registration (wizard already stored key via /wizard/validate-key)
      if (!preBotId && !isTrialConversion) {
        console.log(`[stripe-webhook] Creating fallback AI config for bot ${botId}`);
        await createBYOKConfig({
          botId,
          connectionType: "byok",
          provider: meta["aiProvider"] ?? "google",
          model: meta["aiModel"] ?? "gemini-2.0-flash",
          encryptedKey: undefined,
          keyPreview: undefined,
        });
      }

      // 4. Create Subscription record
      // Stan Store might charge one-time via standard checkout, so we fallback to the session ID if subscription isn't present
      if (session.subscription || session.payment_status === "paid") {
        await createBYOKSubscription({
          userId,
          botId,
          stripeSubscriptionId: (session.subscription as string) || `stan_store_sale_${session.id}`,
          planTier: "byok_basic"
        });
      }

      // HALT AUTO-PROVISIONING IF STAN STORE
      if (!preBotId && !isTrialConversion) {
        console.log(`[stripe-webhook] 🛍️ STAN STORE PRE-SALE for ${email}. User created, waiting for Wizard completion.`);
        await logAdminEvent("stan_store_purchase", botId, { email, slug, sessionId: session.id });
        
        // Dispatch the V4 magic link email to the customer
        await sendStanStoreWelcome(email, name);
        
        return; // The wizard's hatch endpoint will do the actual provisioning later
      }

      if (isTrialConversion) {
        // We unlocked them. No need to provision again.
        console.log(`[stripe-webhook] ✅ Trial-to-paid conversion complete for ${slug}`);
        return;
      }

      // 5. Enqueue provisioning job (Legacy V3 Native flow where Wizard ran first)
      await provisionQueue.add('tenant-provisioning', {
        userId,
        botId,
        slug,
        name,
        email,
        flavor,
        region,
        language,
        preferredChannel,
        timezone,
      }, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
      });

      console.log(`[stripe-webhook] ✅ Successfully enqueued provisioning for ${slug}`);
      await logAdminEvent("stripe_webhook_success", botId, { email, slug, sessionId: session.id });

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
