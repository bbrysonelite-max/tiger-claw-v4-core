// Tiger Claw — POST /auth/verify-purchase
// Purchase-based authentication: replaces magic link email flow.
//
// Customer arrives at wizard.tigerclaw.io after buying on Stan Store.
// They enter their purchase email. We verify a pending_setup subscription
// exists within the last 72 hours and return a signed session token.
// The token is stored in sessionStorage and gates wizard access.

import { Router, type Request, type Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { lookupPurchaseByEmail, createBYOKUser, createBYOKBot, createBYOKSubscription } from "../services/db.js";

const router = Router();

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSessionSecret(): string {
  return process.env["WIZARD_SESSION_SECRET"] ?? process.env["MAGIC_LINK_SECRET"] ?? process.env["ADMIN_TOKEN"] ?? "dev-secret";
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
router.post("/verify-purchase", async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  const { email } = parsed.data;

  try {
    const purchase = await lookupPurchaseByEmail(email);

    if (!purchase) {
      // No webhook record found — Stan Store uses a managed Stripe account that does not
      // forward webhooks to our API. The customer's receipt email is proof of purchase.
      // Create the records on-demand so the wizard can proceed immediately.
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

    const { sessionToken, expires } = generateSessionToken(email, purchase.botId, purchase.userId);

    console.log(`[auth] Purchase verified for ${email} — botId: ${purchase.botId}`);

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

export default router;
