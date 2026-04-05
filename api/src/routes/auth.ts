// Tiger Claw — POST /auth/verify-purchase
// Purchase-based authentication: replaces magic link email flow.
//
// Customer arrives at wizard.tigerclaw.io after buying on Stan Store.
// They enter their purchase email. We verify a pending_setup subscription
// exists within the last 72 hours and return a signed session token.
// The token is stored in sessionStorage and gates wizard access.

import { Router, type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { rateLimit } from "express-rate-limit";
import { lookupPurchaseByEmail, createBYOKUser, createBYOKBot, createBYOKSubscription } from "../services/db.js";

// Rate limiter: 10 attempts per IP per 15 minutes.
// Prevents email enumeration and on-demand DB record spam.
const verifyPurchaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many requests. Please try again later." });
  },
});

const router = Router();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSessionSecret(): string {
  const secret = process.env["WIZARD_SESSION_SECRET"] ?? process.env["MAGIC_LINK_SECRET"];
  if (!secret) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("[auth] WIZARD_SESSION_SECRET must be set in production.");
    }
    return "dev-secret-local-only";
  }
  return secret;
}

function generateSessionToken(email: string, botId: string, userId: string): { sessionToken: string; expires: number } {
  const expires = Date.now() + SESSION_TTL_MS;
  const data = JSON.stringify({ email, botId, userId, expires });
  const sig = createHmac("sha256", getSessionSecret()).update(data).digest("hex");
  const sessionToken = Buffer.from(JSON.stringify({ data, sig })).toString("base64url");
  return { sessionToken, expires };
}

export function verifySessionToken(token: string): { email: string; botId: string; userId: string; expires: number } | null {
  try {
    const parsed = JSON.parse(Buffer.from(token, "base64url").toString());
    const { data, sig } = parsed as { data: string; sig: string };
    const expected = createHmac("sha256", getSessionSecret()).update(data).digest("hex");
    if (!timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
    const payload = JSON.parse(data) as { email: string; botId: string; userId: string; expires: number };
    if (Date.now() > payload.expires) return null;
    return payload;
  } catch {
    return null;
  }
}

// ── POST /auth/verify-purchase ────────────────────────────────────────────────
router.post("/verify-purchase", verifyPurchaseLimiter, async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  const { email } = parsed.data;

  try {
    const purchase = await lookupPurchaseByEmail(email);

    if (!purchase) {
      // If Lemon Squeezy is configured, purchases must arrive via webhook first
      if (process.env["LEMONSQUEEZY_SIGNING_SECRET"]) {
        console.warn(`[auth] No purchase record for ${email} — Lemon Squeezy mode: rejecting`);
        return res.status(404).json({ error: "No purchase found for this email. Please use the link from your purchase confirmation email." });
      }

      // Stan Store fallback: create on-demand (no payment verification)
      // No purchase record found — create on-demand
      console.log(`[auth] No purchase record for ${email} — creating on-demand (Stan Store self-serve)`);

      const name = email.split("@")[0] ?? email;
      const userId = await createBYOKUser(email, name);
      const botId = await createBYOKBot(userId, name, "network-marketer", "pending", email);
      await createBYOKSubscription({
        userId,
        botId,
        stripeSubscriptionId: `stan_store_self_serve_${Date.now()}`,
        planTier: "pro",
        status: "pending_setup",
      });

      console.log(`[auth] On-demand records created for ${email} — botId: ${botId}`);

      const { sessionToken, expires } = generateSessionToken(email, botId, userId);
      return res.json({
        ok: true,
        sessionToken,
        expires,
        botId,
        name,
      });
    }

    // Existing purchase found — check if we can resume or if we need a new one
    // TIGERCLAW-V4 Multi-Agent Rule:
    // If the latest bot for this email is ALREADY live/active, then a re-entry
    // into /verify-purchase means they bought a SECOND agent.
    if (purchase.subscriptionStatus && purchase.subscriptionStatus !== "pending_setup") {
        console.log(`[auth] Active purchase found for ${email} — creating NEW bot for second agent purchase.`);
        
        const userId = purchase.userId;
        const name = purchase.name || email.split("@")[0] || email;
        const botId = await createBYOKBot(userId, name, "network-marketer", "pending", email);
        
        await createBYOKSubscription({
            userId,
            botId,
            stripeSubscriptionId: `stan_store_multi_agent_${Date.now()}`,
            planTier: "pro",
            status: "pending_setup",
        });

        const { sessionToken, expires } = generateSessionToken(email, botId, userId);
        return res.json({
            ok: true,
            sessionToken,
            expires,
            botId,
            name,
        });
    }

    // If subscription doesn't exist at all for some reason, create it
    if (!purchase.subscriptionStatus) {
        console.log(`[auth] Purchase found but no subscription for ${email} — creating pending_setup.`);
        await createBYOKSubscription({
            userId: purchase.userId,
            botId: purchase.botId,
            stripeSubscriptionId: `fix_missing_sub_${Date.now()}`,
            planTier: "pro",
            status: "pending_setup",
        });
    }

    // Normal resume path: status is pending_setup
    const { sessionToken, expires } = generateSessionToken(email, purchase.botId, purchase.userId);

    console.log(`[auth] Purchase verified (resume) for ${email} — botId: ${purchase.botId}`);

    return res.json({
      ok: true,
      sessionToken,
      expires,
      botId: purchase.botId,
      name: purchase.name,
    });

  } catch (err) {
    console.error("[auth] verify-purchase error:", err);
    return res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});

// ── requireSession middleware ─────────────────────────────────────────────────
// Validates the session token from Authorization: Bearer <token>.
// Attaches the decoded session payload to res.locals.session on success.
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"] ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals["session"] = session;
  next();
}

export default router;
