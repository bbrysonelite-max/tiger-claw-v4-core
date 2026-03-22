import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { provisionTenant } from './provisioner.js'; // Multi-tenant provisioner
import { getPool, getTenantBotUsername } from './db.js';
import { sendAdminAlert } from '../routes/admin.js';
import { sendProvisioningReceipt } from './email.js';
import TelegramBot from 'node-telegram-bot-api';

// Provide a stable connection to our newly provisioned Memorystore Redis
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("[FATAL] REDIS_URL environment variable is required");
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
});

export const provisionQueue = new Queue('tenant-provisioning', { connection: connection as any });

console.log('[Queue] BullMQ provision queue configured.');

export const routineQueue = new Queue('ai-routines', { connection: connection as any });
console.log('[Queue] BullMQ ai-routines queue configured.');

export const cronQueue = new Queue('global-cron', { connection: connection as any });
console.log('[Queue] BullMQ global-cron queue configured.');

export interface ProvisionJobData {
    userId: string;
    botId: string;
    slug: string;
    name: string;
    email: string;
    flavor: string;
    region: string;
    language: string;
    preferredChannel: string;
    botToken?: string; // optional — provisioner assigns from pool if not provided
    timezone?: string;
}

const SHOULD_RUN_WORKERS = process.env.ENABLE_WORKERS === 'true';

// Background worker that provisions the tenant state and sets up webhook listeners
export const provisionWorker = SHOULD_RUN_WORKERS ? new Worker(
    'tenant-provisioning',
    async (job: Job<ProvisionJobData>) => {
        console.log(`[Worker] Started provisioning job ${job.id} for slug: ${job.data.slug}`);

        try {
            // Logically decoupled provisioning flow
            const result = await provisionTenant({
                slug: job.data.slug,
                name: job.data.name,
                email: job.data.email,
                flavor: job.data.flavor,
                region: job.data.region,
                language: job.data.language,
                preferredChannel: job.data.preferredChannel,
                botToken: job.data.botToken,
                timezone: job.data.timezone,
            });

            if (!result.success) {
                throw new Error(`Tenant provisioning failed for ${job.data.slug}: ${result.error}`);
            }

            // Waitlisted: pool was empty — bot is pending, NOT live. Do not mark as live.
            if (result.waitlisted) {
                console.warn(`[Worker] Tenant ${job.data.slug} provisioned but waitlisted (pool empty). Bot stays pending.`);
                const pool = getPool();
                await pool.query("UPDATE bots SET status = 'pending' WHERE id = $1", [job.data.botId]);
                await sendAdminAlert(
                    `⏳ Tenant provisioned but WAITLISTED (pool empty): ${job.data.name} (${job.data.slug})\n` +
                    `Add bot tokens via ops/botpool to activate.`
                );
                return result;
            }

            console.log(`[Worker] Succeeded provisioning job ${job.id}. Tenant live.`);

            // Update the Bot ID State successfully
            const pool = getPool();
            await pool.query("UPDATE bots SET status = 'live', deployed_at = NOW() WHERE id = $1", [job.data.botId]);

            await sendAdminAlert(
                `✅ New tenant provisioned via Queue (Blowout Protection)!\n` +
                `Name: ${job.data.name}\nSlug: ${job.data.slug}\nFlavor: ${job.data.flavor}\n`
            );

            if (job.data.email && result.tenant?.id) {
                const botUsername = await getTenantBotUsername(result.tenant.id);
                if (botUsername) {
                    await sendProvisioningReceipt(job.data.email, botUsername, "BYOK Basic");
                }
            }

            return result;
        } catch (error) {
            console.error(`[Worker] Fatal error provisioning job ${job.id}:`, error);

            // Wait to alert admins until it hard-fails entirely or just alert now? Let bullmq retry, but mark it erroring
            const pool = getPool();
            await pool.query("UPDATE bots SET status = 'error' WHERE id = $1", [job.data.botId]);

            await sendAdminAlert(
                `❌ Provisioning Worker FAILED for ${job.data.name} (${job.data.slug})\n` +
                `Error: ${error}`
            );

            throw error; // Let BullMQ handle exponential backoffs
        }
    },
    {
        connection: connection as any,
        // Concurrency protection: Do not provision more than 10 pods simultaneously per worker
        concurrency: 10,
        // Optional limits: max 50 jobs per minute per node
        limiter: {
            max: 50,
            duration: 60000,
        }
    }
) : null;

if (provisionWorker) {
    provisionWorker.on('failed', (job, err) => {
        console.error(`[Worker] Provisioning Job ${job?.id} failed. Error:`, err);
    });
}

// ---------------------------------------------------------------------------
// Telegram Webhook Queue (Stateless Architecture)
// ---------------------------------------------------------------------------

export const telegramQueue = new Queue('telegram-webhooks', { connection: connection as any });
console.log('[Queue] BullMQ telegram webhook queue configured.');

export interface TelegramWebhookJobData {
    tenantId: string;
    botToken?: string;
    payload: any;
}

export const telegramWorker = SHOULD_RUN_WORKERS ? new Worker(
    'telegram-webhooks',
    async (job: Job<TelegramWebhookJobData>) => {
        const { tenantId, botToken, payload } = job.data;
        if (!botToken) {
            console.error(`[Worker] Bot token missing for tenant: ${tenantId}. Aborting Telegram update.`);
            return { success: false, error: "Missing botToken" };
        }

        console.log(`[Worker] Processing Telegram Webhook for tenant: ${tenantId}`);

        try {
            const bot = new TelegramBot(botToken);

            // Extract the message text and chat id
            if (payload.message && payload.message.chat) {
                const chatId = payload.message.chat.id;
                const text = (payload.message.text ?? "").trim();

                // BUG FIX: do not waste an API call on empty/non-text messages
                if (!text) {
                    console.log(`[Worker] Skipping non-text message from chat ${chatId} for tenant ${tenantId}`);
                    return { success: true, skipped: true };
                }

                // Delegate to the Stateless AI engine
                const { processTelegramMessage } = await import('./ai.js');
                await processTelegramMessage(tenantId, botToken, chatId, text);
            }
        } catch (err) {
            console.error(`[Worker] Error processing Webhook for tenant ${tenantId}:`, err);
            throw err;
        }

        return { success: true };
    },
    {
        connection: connection as any,
        concurrency: 50, // Higher concurrency since these are chat payloads
    }
) : null;

if (telegramWorker) {
    telegramWorker.on('failed', (job, err) => {
        console.error(`[Worker] Telegram Job ${job?.id} failed. Error:`, err);
    });
}

// ---------------------------------------------------------------------------
// LINE Webhook Queue
// ---------------------------------------------------------------------------

export const lineQueue = new Queue('line-webhooks', { connection: connection as any });
console.log('[Queue] BullMQ LINE webhook queue configured.');

export interface LineWebhookJobData {
    tenantId: string;
    encryptedChannelAccessToken: string;
    userId: string;
    text: string;
}

export const lineWorker = SHOULD_RUN_WORKERS ? new Worker(
    'line-webhooks',
    async (job: Job<LineWebhookJobData>) => {
        const { tenantId, encryptedChannelAccessToken, userId, text } = job.data;
        console.log(`[Worker] Processing LINE webhook for tenant: ${tenantId}`);

        try {
            const { processLINEMessage } = await import('./ai.js');
            await processLINEMessage(tenantId, encryptedChannelAccessToken, userId, text);
        } catch (err) {
            console.error(`[Worker] Error processing LINE message for tenant ${tenantId}:`, err);
            throw err;
        }

        return { success: true };
    },
    {
        connection: connection as any,
        concurrency: 50,
    }
) : null;

if (lineWorker) {
    lineWorker.on('failed', (job, err) => {
        console.error(`[Worker] LINE Job ${job?.id} failed. Error:`, err);
    });
}

// ---------------------------------------------------------------------------
// Background AI Routines (Scouting, Nurture Checks, Daily Reports)
// ---------------------------------------------------------------------------

export interface AIRoutineJobData {
    tenantId: string;
    routineType: 'daily_scout' | 'nurture_check';
}

export const routineWorker = SHOULD_RUN_WORKERS ? new Worker(
    'ai-routines',
    async (job: Job<AIRoutineJobData>) => {
        const { tenantId, routineType } = job.data;
        console.log(`[Worker] Started AI Routine '${routineType}' for tenant: ${tenantId}`);

        try {
            // Forward the routine execution to the Stateless AI Gateway
            const { processSystemRoutine } = await import('./ai.js');
            await processSystemRoutine(tenantId, routineType);
        } catch (err) {
            console.error(`[Worker] Error executing routine ${routineType} for tenant ${tenantId}:`, err);
            throw err;
        }

        return { success: true };
    },
    {
        connection: connection as any,
        concurrency: 20,
    }
) : null;

if (routineWorker) {
    routineWorker.on('failed', (job, err) => {
        console.error(`[Worker] Routine Job ${job?.id} failed. Error:`, err);
    });
}

// ---------------------------------------------------------------------------
// Global Heartbeat Scheduler
// ---------------------------------------------------------------------------

export const cronWorker = SHOULD_RUN_WORKERS ? new Worker(
    'global-cron',
    async () => {
        console.log(`[Cron] Global Heartbeat triggered. Polling PostgreSQL for tasks...`);
        try {
            const pool = getPool();
            // Fetch all active tenants and check hours since creation for Trial Engine
            const { rows: tenants } = await pool.query("SELECT id, created_at FROM tenants WHERE status = 'active'");

            const nowHour = new Date().getUTCHours();
            const today = new Date().toISOString().split('T')[0];

            for (const tenant of tenants) {
                // Handle 72hr free trial engine natively using the bot memory states
                const hoursElapsed = (Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60);
                
                // Read underlying Bot State explicitly to ensure idempotency so we do not spam messages
                const { getBotState, setBotState } = await import('./db.js');
                const botState = JSON.parse(await getBotState(tenant.id, 'key_state.json') || '{}');
                
                if (!botState.layer2Key) {
                    botState.trialRemindersSent = botState.trialRemindersSent || {};
                    const { h24, h48, h72 } = botState.trialRemindersSent;

                    let fireReminder: string | null = null;
                    if (hoursElapsed >= 72 && !h72 && !botState.tenantPaused) {
                        fireReminder = 'trial_reminder_72h';
                        botState.trialRemindersSent.h72 = true;
                    } else if (hoursElapsed >= 48 && hoursElapsed < 72 && !h48) {
                        fireReminder = 'trial_reminder_48h';
                        botState.trialRemindersSent.h48 = true;
                    } else if (hoursElapsed >= 24 && hoursElapsed < 48 && !h24) {
                        fireReminder = 'trial_reminder_24h';
                        botState.trialRemindersSent.h24 = true;
                    }

                    if (fireReminder) {
                        await setBotState(tenant.id, 'key_state.json', botState);
                        await routineQueue.add(fireReminder, {
                            tenantId: tenant.id,
                            routineType: fireReminder,
                        }, { jobId: `${fireReminder}_${tenant.id}`, removeOnComplete: true });
                    }
                }

                // Nurture check — runs every cron cycle (dedup prevents parallel runs)
                await routineQueue.add('nurture_check', {
                    tenantId: tenant.id,
                    routineType: 'nurture_check',
                }, { jobId: `nurture_${tenant.id}`, removeOnComplete: true, removeOnFail: true });

                // BUG FIX: daily_scout was never scheduled — runs once per day at 7 AM UTC
                if (nowHour === 7) {
                    await routineQueue.add('daily_scout', {
                        tenantId: tenant.id,
                        routineType: 'daily_scout',
                    }, { jobId: `scout_${tenant.id}_${today}`, removeOnComplete: true, removeOnFail: true });
                }
            }

            console.log(`[Cron] Enqueued routine checks for ${tenants.length} active tenants (hour: ${nowHour} UTC).`);
        } catch (err) {
            console.error(`[Cron] Heartbeat check failed:`, err);
            throw err;
        }
    },
    { 
        connection: connection as any, 
        concurrency: 1,
    }
) : null;

if (cronWorker) {
    cronWorker.on('failed', (job, err) => {
        console.error(`[Worker] Cron Job ${job?.id} failed. Global heartbeat may have missed a cycle. Error:`, err);
    });

    // Schedule the global cron to run every minute ONLY if worker is initialized
    cronQueue.add('heartbeat', {}, {
        repeat: { pattern: '* * * * *' },
        jobId: 'global_heartbeat_cron' // ensures singleton
    }).catch(err => {
        console.error('[Queue] Failed to schedule global cron:', err);
    });
}
