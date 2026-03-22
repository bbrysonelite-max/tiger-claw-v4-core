import { Resend } from "resend";

const resend = new Resend(process.env["RESEND_API_KEY"] ?? "re_mock_key");
const FROM_EMAIL = "Tiger Claw <hello@api.tigerclaw.io>";

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
          <li>Log into your <a href="${process.env["FRONTEND_URL"] ?? "https://app.tigerclaw.io"}">Customer Dashboard</a> to configure LINE or WhatsApp.</li>
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
          <li>Log into your <a href="${process.env["FRONTEND_URL"] ?? "https://app.tigerclaw.io"}">Tiger Claw dashboard</a> and securely save it.</li>
        </ul>
        <p>Need help? Reply to this email.</p>
      `,
    });
    console.log(`[Email] sendKeyAbuseWarning (Strike ${strike}) sent to ${email}`);
  } catch (error) {
    console.error(`[Email] sendKeyAbuseWarning failed:`, error);
  }
}

export async function sendStanStoreWelcome(email: string, name: string, productName: string = "Tiger Claw"): Promise<void> {
  const isMock = process.env["RESEND_API_KEY"] === undefined;
  const frontendUrl = process.env["FRONTEND_URL"] ?? "https://app.tigerclaw.io";
  const claimUrl = `${frontendUrl}/wizard?email=${encodeURIComponent(email)}`;
  
  if (isMock) {
    console.log(`[Email] MOCK sendStanStoreWelcome to ${email} (URL: ${claimUrl})`);
    return;
  }

  const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0f;color:#e8e8f0;border-radius:12px;">
  <h2 style="color:#f59e0b;margin-top:0;">🐯 Your ${productName} is ready!</h2>
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

