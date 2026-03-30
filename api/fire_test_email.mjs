// Fire test — verifies Resend is wired and sending
// Run from api/ directory: node fire_test_email.mjs
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY not set. Export it first:");
  console.error("   export RESEND_API_KEY=re_...");
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);
const email = "bbryson@me.com";
const name = "Brent";
const frontendUrl = "https://wizard.tigerclaw.io";
const claimUrl = `${frontendUrl}?email=${encodeURIComponent(email)}`;

const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0f;color:#e8e8f0;border-radius:12px;">
  <h2 style="color:#f59e0b;margin-top:0;">🐯 Your Tiger Claw is ready!</h2>
  <p>Hi ${name},</p>
  <p>You're one click away from your personal AI prospecting assistant. Tap the button below to set it up.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${claimUrl}" style="display:inline-block;background:#f59e0b;color:#0a0a0f;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
      Claim My Tiger Claw →
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px;line-height:1.6;">
    This link is securely tied to your email address.<br>
    After claiming, your personal Tiger Claw bot will message you on Telegram within 60 seconds.
  </p>
</div>`;

console.log(`Sending fire test email to ${email}...`);
console.log(`Magic link: ${claimUrl}\n`);

const { data, error } = await resend.emails.send({
  from: "Tiger Claw <hello@tigerclaw.io>",
  to: email,
  subject: "🐯 [FIRE TEST] Your Tiger Claw Scout is ready to claim",
  html: emailHtml,
});

if (error) {
  console.error("❌ Resend error:", JSON.stringify(error, null, 2));
  process.exit(1);
}

console.log("✅ Email sent! Resend ID:", data.id);
console.log("\nCheck bbryson@me.com — click the link and walk through the wizard.");
