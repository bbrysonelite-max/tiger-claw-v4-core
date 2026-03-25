// Tiger Claw API — Multi-Tenant Provisioner Service
// TIGERCLAW-MASTER-SPEC-v2.md Block 5.1 "60 seconds from payment to bot sending first message"
// RE-ARCHITECTED FOR MULTI-TENANCY: No container spinning. Just DB inserts and instant activation.

import {
  createTenant,
  getTenantBySlug,
  updateTenantStatus,
  logAdminEvent,
  listBotPool,
  assignBotToken,
  getPoolStats,
  getPool,
  getBotState,
  setBotState,
  checkAndGrantFoundingMember,
  type Tenant,
} from "./db.js";
import { releaseBot, decryptToken } from "./pool.js";
import { sendAdminAlert } from "../routes/admin.js";
import { logLearning } from "./self-improvement.js";
import { VALID_FLAVOR_KEYS } from "../tools/flavorConfig.js";
// Proactive initiation disabled temporarily during CORS testing

// ---------------------------------------------------------------------------
// Provision input
// ---------------------------------------------------------------------------

export interface ProvisionInput {
  slug: string;
  name: string;
  email?: string;
  flavor: string;
  region: string;
  language: string;
  preferredChannel: string;
  botToken?: string;
  timezone?: string;
  vertical?: string;
  hiveOptIn?: boolean;
}

export interface ProvisionResult {
  success: boolean;
  waitlisted?: boolean;
  tenant?: Tenant;
  error?: string;
  steps: string[];
}

// ---------------------------------------------------------------------------
// Main provisioner
// ---------------------------------------------------------------------------

export async function provisionTenant(input: ProvisionInput): Promise<ProvisionResult> {
  const steps: string[] = [];

  // Guard: reject unknown flavor keys before touching the DB
  if (!(VALID_FLAVOR_KEYS as readonly string[]).includes(input.flavor)) {
    const msg = `Invalid flavor key: "${input.flavor}". Valid keys: ${VALID_FLAVOR_KEYS.join(", ")}`;
    console.error(`[provisioner] ${msg}`);
    return { success: false, error: msg, steps };
  }

  // 1. Lookup existing tenant (Stan Store hook creates them via createBYOKBot -> tenants insert)
  let tenant = await getTenantBySlug(input.slug);
  let resolvedBotToken = input.botToken;

  if (tenant) {
    steps.push(`Found pre-existing tenant record: ${tenant.id} (Updating with final configs)`);
  } else {
    steps.push(`No pre-existing tenant found for slug ${input.slug}, will create new.`);
  }

  if (!resolvedBotToken) {
    const stats = await getPoolStats();
    if (stats.unassigned === 0) {
      // Pool empty — put tenant on waitlist, do NOT fail payment
      steps.push("Pool empty — tenant added to waitlist");

      let waitlistTenant: Tenant;
      try {
        if (tenant) {
          await getPool().query(
            `UPDATE tenants SET flavor = $1, region = $2, language = $3, preferred_channel = $4, status = 'waitlisted' WHERE id = $5`,
            [input.flavor, input.region, input.language, input.preferredChannel, tenant.id]
          );
          const refreshed = await getTenantBySlug(input.slug);
          if (!refreshed) throw new Error("Tenant disappeared during update");
          waitlistTenant = refreshed;
        } else {
          waitlistTenant = await createTenant({
            slug: input.slug,
            name: input.name,
            email: input.email,
            flavor: input.flavor,
            region: input.region,
            language: input.language,
            preferredChannel: input.preferredChannel,
            botToken: undefined,
          });
          await updateTenantStatus(waitlistTenant.id, "waitlisted");
        }
      } catch (err) {
        return { success: false, error: `DB error: ${err instanceof Error ? err.message : String(err)}`, steps };
      }

      await sendAdminAlert("Bot token pool is empty. Add tokens via ops/botpool/create_bots.ts before provisioning.");
      await logAdminEvent("waitlist", waitlistTenant.id, { reason: "pool_empty", slug: input.slug });
      return {
        success: true,
        waitlisted: true,
        tenant: waitlistTenant,
        steps,
        error: undefined,
      };
    }
  } else {
    steps.push("Bot token provided directly (admin override)");
  }

  // 2. Create or Update tenant record
  try {
    if (tenant) {
      // The tenant exists (probably from a Stan Store presale or /wizard/auth flow)
      // Just update it with the final configs
      await getPool().query(
        `UPDATE tenants SET 
            flavor = $1, region = $2, language = $3, preferred_channel = $4, bot_token = COALESCE($5, bot_token)
           WHERE id = $6`,
        [input.flavor, input.region, input.language, input.preferredChannel, resolvedBotToken || null, tenant.id]
      );
      // Refresh the object in memory
      const refreshed = await getTenantBySlug(input.slug);
      if (!refreshed) throw new Error("Tenant disappeared during update");
      tenant = refreshed;
    } else {
      tenant = await createTenant({
        slug: input.slug,
        name: input.name,
        email: input.email,
        flavor: input.flavor,
        region: input.region,
        language: input.language,
        preferredChannel: input.preferredChannel,
        botToken: resolvedBotToken,
        port: undefined,
      });
      steps.push(`New Tenant record created: ${tenant.id}`);
    }
  } catch (err) {
    return { success: false, error: `DB error: ${err instanceof Error ? err.message : String(err)}`, steps };
  }

  // Assign bot token from pool 
  if (!input.botToken) {
    const assigned = await assignBotToken(tenant.id);
    if (!assigned) {
      await updateTenantStatus(tenant.id, "pending");
      await sendAdminAlert("Bot token pool is empty. Add tokens via ops/botpool/create_bots.ts before provisioning.");
      return { success: true, waitlisted: true, tenant, steps: [...steps, "Pool emptied during assignment — waitlisted"], error: undefined };
    }
    resolvedBotToken = decryptToken(assigned.botToken);

    // Update tenant record with the assigned bot token
    await getPool().query("UPDATE tenants SET bot_token = $1, updated_at = NOW() WHERE id = $2", [resolvedBotToken, tenant.id]);
    steps.push(`Bot assigned from pool: @${assigned.botUsername}`);

    // Low-pool alert
    const postStats = await getPoolStats();
    if (postStats.unassigned < 50) {
      await sendAdminAlert(`Bot token pool low: ${postStats.unassigned} tokens remaining. Add more via ops/botpool.`);
    }
  }

  // 3. Multi-Tenant Activation! No Docker containers to spin up. 
  // We simply register an active Webhook with Telegram for the newly assigned token bridging directly to this API cluster.

  try {
    const baseUrl = (process.env["TIGER_CLAW_API_URL"] || "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("[FATAL] TIGER_CLAW_API_URL environment variable is required");
    const webhookUrl = `${baseUrl}/webhooks/telegram/${tenant.id}`;

    // Call Telegram API to set the webhook (Use POST with JSON to avoid URL encoding issues)
    const webhookSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];
    const tgResponse = await fetch(`https://api.telegram.org/bot${resolvedBotToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, ...(webhookSecret ? { secret_token: webhookSecret } : {}) })
    });
    const tgData = await tgResponse.json();

    if (!tgData.ok) {
      await logLearning({
        type: "ERROR",
        code: `ERR-PROV-TG-${Date.now()}`,
        description: `Telegram Webhook failed: ${tgData.description}`,
        context: { slug: tenant.slug, botToken: "********", description: tgData.description }
      });
      throw new Error(`Telegram Webhook failed: ${tgData.description}`);
    }

    // GAP 12: Telegram Rebranding
    // We update the bot's profile on Telegram to match the new tenant's identity.
    try {
      console.log(`[provisioner] Rebranding Telegram profile...`);
      
      // Update Display Name
      await fetch(`https://api.telegram.org/bot${resolvedBotToken}/setMyName?name=${encodeURIComponent(tenant.name)}`);
      
      // Update Description/Bio
      const description = `AI-powered ${input.flavor} agent for ${tenant.name}. Managed by Tiger Claw.`;
      await fetch(`https://api.telegram.org/bot${resolvedBotToken}/setMyDescription?description=${encodeURIComponent(description)}`);
      
      steps.push(`Telegram profile rebranded to: ${tenant.name}`);
    } catch (rebrandErr) {
      console.warn(`[provisioner] Telegram rebrand failed (non-fatal):`, rebrandErr);
    }

    steps.push(`Telegram webhook attached to Master API router successfully.`);

    // Unified 'Leader' Class Hatching
    steps.push(`Leader Core active: Browser [ON], Memory [ON], Evolution [ON]`);
    
    console.log(`[provisioner] Agent ${tenant.slug} is now AWAKE and ready to hunt.`);
    
    // GAP 10: Proactive Initiation
    // We fire the 'Wake Up' signal. This triggers Gemini to introduce itself and start the interview.
    // Note: We need a chatId to send a message. Since hatching is async, we'll trigger this 
    // the moment the bot receives its first /start OR we use the pre-registered admin chat if available.
    if (input.email === "brentbryson@me.com" && resolvedBotToken) {
        const ADMIN_CHAT_ID = parseInt(process.env["ADMIN_TELEGRAM_CHAT_ID"] || "0");
        if (ADMIN_CHAT_ID) {
            console.log(`[provisioner] Sending proactive intake to Admin Chat for ${tenant.slug}`);
            // await triggerProactiveInitiation(tenant.id, resolvedBotToken, ADMIN_CHAT_ID);
        }
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    steps.push(`Webhook attachment FAILED: ${errMsg}`);

    await updateTenantStatus(tenant.id, "suspended", {
      suspendedReason: `Webhook attachment failed: ${errMsg}`,
    });

    // Release the pool bot back to available so it isn't leaked on BullMQ retry.
    // On retry, provisionTenant() will assign a fresh bot from the pool.
    // Only release if the bot was drawn from the pool (not a direct admin override).
    if (!input.botToken) {
      try {
        const poolBots = await listBotPool("assigned");
        const assignedBot = poolBots.find((b) => b.tenantId === tenant.id);
        if (assignedBot) {
          await releaseBot(assignedBot.id);
          // Clear bot_token on tenant record so retry gets a clean pool assignment
          await getPool().query(
            `UPDATE tenants SET bot_token = NULL WHERE id = $1`,
            [tenant.id]
          );
          steps.push(`Pool bot @${assignedBot.botUsername} released for retry`);
        }
      } catch (releaseErr) {
        console.warn(`[provisioner] Failed to release pool bot after webhook failure for ${tenant.id}:`, releaseErr);
      }
    }

    return {
      success: false,
      error: `Webhook attach failed: ${errMsg}`,
      steps,
      tenant,
    };
  }

  // 4. Status → onboarding (Bot is instantly LIVE and listening on the master router)
  await updateTenantStatus(tenant.id, "onboarding");
  steps.push("Status: onboarding");

  // Bot is live. Waiting for tenant to trigger it via Telegram.
  steps.push("Bot ready — awaiting tenant's first inbound message to start onboarding");

  await logAdminEvent("provision", tenant.id, {
    slug: input.slug,
    flavor: input.flavor,
    region: input.region,
  });

  // 5. Fire-and-forget Check & Grant Founding Member
  const vertical = input.vertical || input.flavor;
  const hiveOptIn = input.hiveOptIn ?? true;
  if (hiveOptIn && vertical && input.region) {
    checkAndGrantFoundingMember(tenant.id, vertical, input.region).catch((err) => {
      console.error(`[provisioner] Failed to grant founding member status to ${tenant.id}`, err);
    });
    steps.push(`Evaluated Founding Member eligibility for ${vertical}:${input.region}`);
  }

  return { success: true, tenant, steps };
}

// ---------------------------------------------------------------------------
// Suspend a tenant 
// ---------------------------------------------------------------------------

export async function suspendTenant(
  tenant: Tenant,
  reason = "Admin action"
): Promise<void> {
  // Drop Telegram webhook so it stops receiving messages
  if (tenant.botToken) {
    await fetch(`https://api.telegram.org/bot${tenant.botToken}/deleteWebhook`);
  }
  // Set tenantPaused in key_state so LINE and any other channel also stop consuming API keys
  try {
    const botState = JSON.parse(await getBotState(tenant.id, "key_state.json") || "{}");
    botState.tenantPaused = true;
    await setBotState(tenant.id, "key_state.json", botState);
  } catch (err: any) {
    console.error(`[provisioner] Failed to set tenantPaused for ${tenant.id}:`, err.message);
  }
  await updateTenantStatus(tenant.id, "suspended", { suspendedReason: reason });
  await logAdminEvent("suspend", tenant.id, { reason });
}

// ---------------------------------------------------------------------------
// Resume a suspended tenant
// ---------------------------------------------------------------------------

export async function resumeTenant(tenant: Tenant): Promise<"active" | "onboarding"> {
  if (tenant.botToken) {
    const baseUrl = (process.env["TIGER_CLAW_API_URL"] || "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("[FATAL] TIGER_CLAW_API_URL environment variable is required");
    const webhookUrl = `${baseUrl}/webhooks/telegram/${tenant.id}`;

    const webhookSecret = process.env["TELEGRAM_WEBHOOK_SECRET"];
    await fetch(`https://api.telegram.org/bot${tenant.botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, ...(webhookSecret ? { secret_token: webhookSecret } : {}) })
    });
  }
  // Clear tenantPaused so LINE and other channels resume consuming API keys
  try {
    const botState = JSON.parse(await getBotState(tenant.id, "key_state.json") || "{}");
    delete botState.tenantPaused;
    await setBotState(tenant.id, "key_state.json", botState);
  } catch (err: any) {
    console.error(`[provisioner] Failed to clear tenantPaused for ${tenant.id}:`, err.message);
  }
  // Determine correct status: check actual onboarding completion in bot_states.
  // onboardingKeyUsed is never incremented — use the onboarding phase state instead.
  let status: "active" | "onboarding" = "onboarding";
  try {
    const onboardState = await getBotState<{ phase?: string }>(tenant.id, "onboard_state.json");
    if (onboardState?.phase === "complete") {
      status = "active";
    }
  } catch {
    // Fall back to onboarding if state is unreadable
  }
  await updateTenantStatus(tenant.id, status);
  await logAdminEvent("resume", tenant.id, {});
  return status;
}

// ---------------------------------------------------------------------------
// Terminate a tenant 
// ---------------------------------------------------------------------------

export async function terminateTenant(tenant: Tenant): Promise<void> {
  if (tenant.botToken) {
    await fetch(`https://api.telegram.org/bot${tenant.botToken}/deleteWebhook`);
  }

  // Release the pool bot back so it can be reassigned to a future tenant
  try {
    const poolBots = await listBotPool("assigned");
    const assignedBot = poolBots.find((b) => b.tenantId === tenant.id);
    if (assignedBot) {
      await releaseBot(assignedBot.id);
    }
  } catch (err) {
    console.error(`[provisioner] terminateTenant: failed to release pool bot for ${tenant.id}:`, err);
  }

  await updateTenantStatus(tenant.id, "terminated");
  await logAdminEvent("terminate", tenant.id, {});
}

// ---------------------------------------------------------------------------
// Deprovision a tenant — full cleanup including bot recycling
// ---------------------------------------------------------------------------

export async function deprovisionTenant(tenant: Tenant): Promise<{ steps: string[] }> {
  const steps: string[] = [];

  if (tenant.botToken) {
    await fetch(`https://api.telegram.org/bot${tenant.botToken}/deleteWebhook`);
    steps.push("Telegram webhook deleted for Bot Token");
  }

  // 2. Find assigned pool bot for this tenant and release it
  try {
    const poolBots = await listBotPool("assigned");
    const assignedBot = poolBots.find((b) => b.tenantId === tenant.id);
    if (assignedBot) {
      await releaseBot(assignedBot.id);
      steps.push(`Pool bot @${assignedBot.botUsername} released and reset`);
    } else {
      steps.push("No pool bot found for tenant (may have been manually assigned)");
    }
  } catch (err) {
    steps.push(`Bot release warning: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Update status
  await updateTenantStatus(tenant.id, "terminated");
  steps.push("Tenant status: terminated");

  await logAdminEvent("deprovision", tenant.id, { slug: tenant.slug, steps });
  return { steps };
}
