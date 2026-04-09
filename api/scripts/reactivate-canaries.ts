#!/usr/bin/env npx ts-node
/**
 * ops/reactivate-canaries.ts
 *
 * Sends a personal re-engagement email to every user who was provisioned
 * before the OpenClaw update killed their bot.
 *
 * DRY_RUN=true (default) — prints each email to console, sends nothing.
 * DRY_RUN=false           — fires real emails via Resend.
 *
 * Usage:
 *   DRY_RUN=true  npx ts-node ops/reactivate-canaries.ts
 *   DRY_RUN=false npx ts-node ops/reactivate-canaries.ts
 */

import { Pool } from "pg";
import { Resend } from "resend";
import * as dotenv from "dotenv";

dotenv.config({ path: "./api/.env" });

const DRY_RUN = process.env.DRY_RUN !== "false";
const DB_URL = process.env.DATABASE_URL;
const RESEND_KEY = process.env.RESEND_API_KEY;
const STAN_STORE_URL = process.env.STAN_STORE_URL ?? "https://stan.store/tigerclaw";
const FROM = "Brent at Tiger Claw <brent@botcraftworks.com>";

if (!DB_URL) throw new Error("DATABASE_URL required");

const pool = new Pool({ connectionString: DB_URL });
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

// ---------------------------------------------------------------------------
// Email copy — personal, not marketing
// ---------------------------------------------------------------------------

function buildEmail(name: string, email: string): { subject: string; html: string; text: string } {
  const firstName = name.split(" ")[0] ?? name;
  const subject = `I owe you an apology, ${firstName}`;

  const text = `
Hi ${firstName},

I'm Brent — I built Tiger Claw.

Your bot went down and stayed down longer than it should have. That's on me.
A code update I pushed broke the infrastructure, and by the time I caught it,
the damage was done. You paid for something and it didn't work. That's not okay.

Here's what I want to do: give you 2 months completely free when you come back.
No catch. You come back, you get 2 months on me, and I've fixed the thing that
broke you.

If you want back in: ${STAN_STORE_URL}

If you don't, I completely understand. Either way — thank you for being one of
the first people to bet on this. That meant something.

— Brent
  `.trim();

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a;line-height:1.7;">
  <p style="margin-top:0;">Hi ${firstName},</p>

  <p>I'm Brent — I built Tiger Claw.</p>

  <p>Your bot went down and stayed down longer than it should have. That's on me.
  A code update I pushed broke the infrastructure, and by the time I caught it,
  the damage was done. You paid for something and it didn't work. That's not okay.</p>

  <p>Here's what I want to do: <strong>give you 2 months completely free</strong> when you come back.
  No catch. You come back, you get 2 months on me, and I've fixed the thing that broke you.</p>

  <p style="text-align:center;margin:32px 0;">
    <a href="${STAN_STORE_URL}"
       style="display:inline-block;background:#f59e0b;color:#0a0a0f;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
      Come Back — 2 Months Free →
    </a>
  </p>

  <p>If you don't want back in, I completely understand. Either way — thank you
  for being one of the first people to bet on this. That meant something.</p>

  <p style="margin-bottom:0;">— Brent</p>

  <p style="margin-top:32px;font-size:12px;color:#9ca3af;">
    BotCraft Works · Scottsdale, AZ<br>
    Reply to this email if you have questions.
  </p>
</div>`;

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n[reactivate-canaries] DRY_RUN=${DRY_RUN}\n`);

  const { rows } = await pool.query<{ name: string; email: string; created_at: string }>(
    `SELECT u.name, u.email, u.created_at
     FROM users u
     JOIN bots b ON b.user_id = u.id
     WHERE u.email IS NOT NULL
     GROUP BY u.id, u.name, u.email, u.created_at
     ORDER BY u.created_at ASC`
  );

  if (rows.length === 0) {
    console.log("[reactivate-canaries] No users found in DB.");
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} user(s):\n`);

  for (const user of rows) {
    const { subject, html, text } = buildEmail(user.name ?? "there", user.email);

    console.log(`─── ${user.name} <${user.email}>`);
    console.log(`    Subject: ${subject}`);

    if (DRY_RUN) {
      console.log(`    [DRY RUN — not sent]\n`);
      console.log(text);
      console.log();
      continue;
    }

    if (!resend) {
      console.error("    [ERROR] RESEND_API_KEY not set — cannot send.");
      continue;
    }

    try {
      const result = await resend.emails.send({
        from: FROM,
        to: user.email,
        replyTo: "brent@botcraftworks.com",
        subject,
        html,
        text,
      });
      console.log(`    ✅ Sent (id: ${result.data?.id ?? "unknown"})\n`);
    } catch (err: any) {
      console.error(`    ❌ Failed: ${err.message}\n`);
    }

    // 1-second pause between sends — avoid Resend rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  await pool.end();
  console.log("[reactivate-canaries] Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
