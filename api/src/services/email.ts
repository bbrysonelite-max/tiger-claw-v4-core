import { Resend } from "resend";
import { createHmac, timingSafeEqual } from "crypto";

const resend = new Resend(process.env["RESEND_API_KEY"] ?? "re_mock_key");
const FROM_EMAIL = "Tiger Claw <hello@tigerclaw.io>";

// ---------------------------------------------------------------------------
// Magic link token helpers
// ---------------------------------------------------------------------------

const MAGIC_LINK_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function getMagicSecret(): string {
  return process.env["MAGIC_LINK_SECRET"] ?? process.env["ADMIN_TOKEN"] ?? "dev-secret";
}

export function generateMagicToken(email: string): { token: string; expires: number } {
  const expires = Date.now() + MAGIC_LINK_TTL_MS;
  const payload = `${email}:${expires}`;
  const token = createHmac("sha256", getMagicSecret()).update(payload).digest("hex");
  return { token, expires };
}

export function verifyMagicToken(email: string, token: string, expires: number): boolean {
  if (Date.now() > expires) return false;
  const payload = `${email}:${expires}`;
  const expected = createHmac("sha256", getMagicSecret()).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function sendProvisioningReceipt(email: string, botUsername: string, planName: string): Promise<void> {
  const isMock = process.env["RESEND_API_KEY"] === undefined;
  
  if (isMock) {
    console.log(`[Email] MOCK sendProvisioningReceipt to ${email} for @${botUsername}`);
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Tiger Claw Agent is Live! 🚀",
      html: `
        <h2>Your AI Agent is ready!</h2>
        <p>Your agent <strong>@${botUsername}</strong> has been successfully provisioned on the ${planName} plan.</p>
        <p><strong>Next steps:</strong></p>
        <ol>
          <li><a href="https://t.me/${botUsername}">Click here to message your bot on Telegram</a></li>
          <li>Log into your <a href="${process.env["FRONTEND_URL"] ?? "https://wizard.tigerclaw.io"}">Customer Dashboard</a> to configure LINE or WhatsApp.</li>
        </ol>
        <p>Happy hunting,<br>Tiger Claw Team</p>
      `,
    });
    console.log(`[Email] sendProvisioningReceipt sent to ${email}`);
  } catch (error) {
    console.error(`[Email] sendProvisioningReceipt failed:`, error);
  }
}

export async function sendKeyAbuseWarning(email: string, strike: number, limit: number): Promise<void> {
  const isMock = process.env["RESEND_API_KEY"] === undefined;
  
  if (isMock) {
    console.log(`[Email] MOCK sendKeyAbuseWarning to ${email} (Strike ${strike})`);
    return;
  }

  const strikeTitles = {
    1: "⚠️ Warning: Emergency Key Usage",
    2: "🚨 Urgent: Emergency Key Almost Exhausted",
    3: "🔴 Action Required: Bot Auto-Paused",
  };

  const strikeContent = {
    1: `<p>Your bot is currently operating on Layer 4 (Emergency Sandbox Mode). You have <strong>${limit} messages remaining</strong>.</p>`,
    2: `<p><strong>URGENT:</strong> Your bot has almost exhausted its emergency messages. You have <strong>${limit} messages remaining</strong>. Please add a Bring-Your-Own-Key (BYOK) immediately to avoid an outage.</p>`,
    3: `<p><strong>Your bot has been automatically paused.</strong> It has exhausted all emergency fallback messages.</p><p>To restore service, please configure your own API key in the customer dashboard and message your bot "restore key".</p>`,
  };

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: strikeTitles[strike as keyof typeof strikeTitles] || "Warning",
      html: `
        <h2>Tiger Claw - System Alert</h2>
        ${strikeContent[strike as keyof typeof strikeContent]}
        <br>
        <p><strong>How to fix this:</strong></p>
        <ul>
          <li>Go to <a href="https://aistudio.google.com/apikey">Google AI Studio</a> and get an API key.</li>
          <li>Log into your <a href="${process.env["FRONTEND_URL"] ?? "https://wizard.tigerclaw.io"}">Tiger Claw dashboard</a> and securely save it.</li>
        </ul>
        <p>Need help? Reply to this email.</p>
      `,
    });
    console.log(`[Email] sendKeyAbuseWarning (Strike ${strike}) sent to ${email}`);
  } catch (error) {
    console.error(`[Email] sendKeyAbuseWarning failed:`, error);
  }
}

export async function sendTrialReminderEmail(
  email: string,
  hoursRemaining: number,
): Promise<void> {
  const isMock = process.env["RESEND_API_KEY"] === undefined;
  const wizardUrl = process.env["FRONTEND_URL"] ?? "https://wizard.tigerclaw.io";

  if (isMock) {
    console.log(`[Email] MOCK sendTrialReminderEmail to ${email} (${hoursRemaining}h remaining)`);
    return;
  }

  const isExpired = hoursRemaining <= 0;
  const subject = isExpired
    ? "⚠️ Your Tiger Claw trial has ended — add your key to resume"
    : `⏰ ${hoursRemaining} hours left on your Tiger Claw trial`;

  const bodyText = isExpired
    ? `<p>Your 72-hour free trial is complete and your bot has been paused.</p>
       <p>To resume, add your Google Gemini API key at <a href="${wizardUrl}">${wizardUrl}</a>.</p>`
    : `<p>You have <strong>${hoursRemaining} hours</strong> remaining on your free trial.</p>
       <p>Add your Google Gemini API key now so your bot keeps working: <a href="${wizardUrl}">${wizardUrl}</a>.</p>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `<h2>Tiger Claw Trial Update</h2>${bodyText}<p>Need help? Reply to this email.</p>`,
    });
    console.log(`[Email] sendTrialReminderEmail (${hoursRemaining}h) sent to ${email}`);
  } catch (error) {
    console.error(`[Email] sendTrialReminderEmail failed:`, error);
  }
}

export async function sendSupportReply(to: string, toName: string, subject: string, replyText: string): Promise<void> {
  const isMock = process.env["RESEND_API_KEY"] === undefined;
  if (isMock) {
    console.log(`[Email] MOCK sendSupportReply to ${to}: ${replyText.slice(0, 80)}`);
    return;
  }

  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a2e;">
  <p>${replyText.replace(/\n/g, "<br>")}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#6b7280;font-size:12px;">
    Tiger Claw Support · <a href="https://tigerclaw.io" style="color:#f59e0b;">tigerclaw.io</a><br>
    Reply to this email to continue the conversation.
  </p>
</div>`;

  try {
    await resend.emails.send({
      from: "Tiger Claw Support <support@tigerclaw.io>",
      to,
      subject: replySubject,
      html,
      replyTo: "support@tigerclaw.io",
    });
    console.log(`[Email] sendSupportReply sent to ${to}`);
  } catch (error) {
    console.error(`[Email] sendSupportReply failed:`, error);
  }
}

export async function sendStanStoreWelcome(email: string, name: string, productName: string = "Tiger Claw"): Promise<void> {
  const isMock = process.env["RESEND_API_KEY"] === undefined;
  const frontendUrl = process.env["FRONTEND_URL"] ?? "https://wizard.tigerclaw.io";
  const { token, expires } = generateMagicToken(email);
  const claimUrl = `${frontendUrl}?email=${encodeURIComponent(email)}&token=${token}&expires=${expires}`;
  
  if (isMock) {
    console.log(`[Email] MOCK sendStanStoreWelcome to ${email} (URL: ${claimUrl})`);
    return;
  }

  const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0f;color:#e8e8f0;border-radius:12px;">
  <h2 style="color:#f59e0b;margin-top:0;">🐯 Your ${productName} is ready!</h2>
  <p>Hi ${name},</p>
  <p>You're one click away from your personal AI prospecting assistant. Tap the button below to start the 4-step setup wizard.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${claimUrl}" style="display:inline-block;background:#f59e0b;color:#0a0a0f;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
      Start Setup Wizard →
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px;line-height:1.6;">
    This link is securely tied to your email address.<br>
    The wizard will guide you through connecting your own Telegram bot and AI keys.
  </p>
</div>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "🐯 Your Tiger Claw Scout is ready to claim",
      html: emailHtml,
    });
    console.log(`[Email] sendStanStoreWelcome sent to ${email}`);
  } catch (error) {
    console.error(`[Email] sendStanStoreWelcome failed:`, error);
  }
}

export async function sendFirstLeadNotification(email: string, name: string, leadCount: number): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Your Tiger Claw agent found your first leads! 🎯",
      html: `
<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
  <h2 style="color:#111827;">Your agent is hunting. 🐯</h2>
  <p style="color:#374151;">Hey ${name},</p>
  <p style="color:#374151;">
    Great news — your Tiger Claw agent just completed its first successful scan and found
    <strong>${leadCount} prospect${leadCount === 1 ? "" : "s"}</strong> that match your ideal customer profile.
  </p>
  <p style="color:#374151;">
    Open your Telegram bot and type <strong>hunt</strong> to see the results and start engaging.
  </p>
  <p style="color:#374151;">The agent will continue scanning automatically every 24 hours.</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="color:#6b7280;font-size:12px;">Tiger Claw · <a href="https://tigerclaw.io" style="color:#f59e0b;">tigerclaw.io</a></p>
</div>`,
    });
    console.log(`[Email] sendFirstLeadNotification sent to ${email} (${leadCount} leads)`);
  } catch (error) {
    console.error(`[Email] sendFirstLeadNotification failed:`, error);
  }
}

