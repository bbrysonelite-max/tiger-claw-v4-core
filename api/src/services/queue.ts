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

export const factExtractionQueue = new Queue('fact-extraction', { connection: connection as any });
console.log('[Queue] BullMQ fact-extraction queue configured.');

export const routineQueue = new Queue('ai-routines', { connection: connection as any });
console.log('[Queue] BullMQ ai-routines queue configured.');

export const cronQueue = new Queue('global-cron', { connection: connection as any });
console.log('[Queue] BullMQ global-cron queue configured.');

export const miningQueue = new Queue('market-mining', { connection: connection as any });
console.log('[Queue] BullMQ market-mining queue configured.');

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
    // 'failed' fires only after ALL retries are exhausted — this is the terminal failure alert
    provisionWorker.on('failed', (job, err) => {
        console.error(`[Worker] Provisioning Job ${job?.id} TERMINAL FAILURE (all retries exhausted). Error:`, err);
        sendAdminAlert(
            `🚨 PROVISIONING TERMINAL FAILURE — all retries exhausted\n` +
            `Job: ${job?.id}\nSlug: ${job?.data?.slug ?? 'unknown'}\nCustomer: ${job?.data?.name ?? 'unknown'} (${job?.data?.email ?? 'unknown'})\nError: ${err?.message ?? String(err)}`
        ).catch(() => {});
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

                // Fire-and-forget fact extraction — must not block or throw
                factExtractionQueue.add('extract', { tenantId, chatId }, {
                    removeOnComplete: true,
                    removeOnFail: true,
                }).catch(err => console.warn(`[Worker] Failed to enqueue fact extraction for tenant ${tenantId}:`, err.message));
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
    // Message failures are expected (user-side issues); only log, do not alert
    telegramWorker.on('failed', (job, err) => {
        console.error(`[Worker] Telegram Job ${job?.id} failed (tenant: ${job?.data?.tenantId ?? 'unknown'}). Error:`, err?.message ?? err);
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

            // Fire-and-forget fact extraction
            factExtractionQueue.add('extract', { tenantId, chatId: userId as unknown as number }, {
                removeOnComplete: true,
                removeOnFail: true,
            }).catch(err => console.warn(`[Worker] Failed to enqueue fact extraction for tenant ${tenantId}:`, err.message));
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
    // Message failures are expected (user-side issues); only log, do not alert
    lineWorker.on('failed', (job, err) => {
        console.error(`[Worker] LINE Job ${job?.id} failed (tenant: ${job?.data?.tenantId ?? 'unknown'}). Error:`, err?.message ?? err);
    });
}

// ---------------------------------------------------------------------------
// Email Support Queue — inbound support emails routed to the AI support agent
// ---------------------------------------------------------------------------

export const emailQueue = new Queue('email-support', { connection: connection as any });
console.log('[Queue] BullMQ email-support queue configured.');

export interface EmailSupportJobData {
    fromEmail: string;
    fromName: string;
    subject: string;
    body: string;
    messageId: string;
}

export const emailWorker = SHOULD_RUN_WORKERS ? new Worker(
    'email-support',
    async (job: Job<EmailSupportJobData>) => {
        const { fromEmail, fromName, subject, body, messageId } = job.data;
        console.log(`[Worker] Processing support email from ${fromEmail}: "${subject}"`);
        try {
            const { processEmailSupportMessage } = await import('./ai.js');
            await processEmailSupportMessage(fromEmail, fromName, subject, body, messageId);
        } catch (err) {
            console.error(`[Worker] Email support job failed for ${fromEmail}:`, err);
            throw err;
        }
        return { success: true };
    },
    {
        connection: connection as any,
        concurrency: 10,
    }
) : null;

if (emailWorker) {
    emailWorker.on('failed', (job, err) => {
        console.error(`[Worker] Email support job ${job?.id} failed (from: ${job?.data?.fromEmail ?? 'unknown'}). Error:`, err?.message ?? err);
    });
}

// ---------------------------------------------------------------------------
// Fact Anchor Extraction (async, post-conversation intelligence)
// ---------------------------------------------------------------------------

export interface FactExtractionJobData {
    tenantId: string;
    chatId: number;
}

export const factExtractionWorker = SHOULD_RUN_WORKERS ? new Worker(
    'fact-extraction',
    async (job: Job<FactExtractionJobData>) => {
        const { tenantId, chatId } = job.data;
        try {
            const { extractFactAnchors } = await import('./factExtractor.js');
            await extractFactAnchors(tenantId, chatId);
        } catch (err) {
            console.warn(`[Worker] Fact extraction failed for tenant ${tenantId} — non-critical:`, err);
            // Do not rethrow — fact extraction failure must never block or retry loudly
        }
        return { success: true };
    },
    {
        connection: connection as any,
        concurrency: 20,
    }
) : null;

if (factExtractionWorker) {
    factExtractionWorker.on('failed', (job, err) => {
        console.warn(`[Worker] Fact extraction job ${job?.id} failed:`, err);
    });
}

// ---------------------------------------------------------------------------
// Background AI Routines (Scouting, Nurture Checks, Daily Reports)
// ---------------------------------------------------------------------------

export interface AIRoutineJobData {
    tenantId: string;
    routineType: 'daily_scout' | 'nurture_check' | 'value_gap_checkin';
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
        console.error(`[Worker] Routine Job ${job?.id} TERMINAL FAILURE. Error:`, err?.message ?? err);
        // Alert for routine failures — missed nurture/scout cycles degrade customer experience
        sendAdminAlert(
            `⚠️ AI Routine TERMINAL FAILURE\nJob: ${job?.id}\nType: ${job?.data?.routineType ?? 'unknown'}\nTenant: ${job?.data?.tenantId ?? 'unknown'}\nError: ${err?.message ?? String(err)}`
        ).catch(() => {});
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
            const { rows: tenants } = await pool.query(`
                SELECT id, created_at, feedback_loop_enabled, feedback_paused,
                       last_feedback_at, feedback_reminder_sent_at, feedback_pause_sent_at
                FROM tenants WHERE status IN ('active', 'live')
            `);

            const nowHour = new Date().getUTCHours();
            const today = new Date().toISOString().split('T')[0];

            // Dedup strategy for trial reminders:
            //   - BullMQ jobId = unique per tenant per reminder type — queue deduplicates
            //   - State (trialRemindersSent) is written BEFORE add() so crash-recovery is safe
            //   - cronWorker concurrency=1 + singleton heartbeat jobId ensures single-writer
            //   - Per-tenant try-catch below isolates failures: one bad tenant never kills the cycle

            const { getBotState, setBotState } = await import('./db.js');

            for (const tenant of tenants) {
                try {
                    // Handle 72hr free trial engine natively using the bot memory states
                    const hoursElapsed = (Date.now() - new Date(tenant.created_at).getTime()) / (1000 * 60 * 60);

                    const botState: Record<string, any> = (await getBotState<Record<string, any>>(tenant.id, 'key_state.json')) ?? {};

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
                            // Write state first — if add() fails, next cycle re-adds (BullMQ jobId dedup prevents double-fire)
                            await setBotState(tenant.id, 'key_state.json', botState);
                            await routineQueue.add(fireReminder, {
                                tenantId: tenant.id,
                                routineType: fireReminder,
                            }, { jobId: `${fireReminder}_${tenant.id}`, removeOnComplete: true });
                        }
                    }

                    // Nurture check — runs every cron cycle (jobId dedup prevents parallel runs)
                    await routineQueue.add('nurture_check', {
                        tenantId: tenant.id,
                        routineType: 'nurture_check',
                    }, { jobId: `nurture_${tenant.id}`, removeOnComplete: true, removeOnFail: true });

                    // daily_scout runs once per day at 7 AM UTC (date-stamped jobId prevents re-add)
                    if (nowHour === 7) {
                        await routineQueue.add('daily_scout', {
                            tenantId: tenant.id,
                            routineType: 'daily_scout',
                        }, { jobId: `scout_${tenant.id}_${today}`, removeOnComplete: true, removeOnFail: true });
                    }

                    // ── Value-gap detection — runs once per day at 9 AM UTC ────────────
                    // CLAUDE.md mandate: any paying tenant with no lead in 7 consecutive
                    // days must receive a genuine diagnostic check-in, not a retention push.
                    if (nowHour === 9) {
                        try {
                            const pool = getPool();
                            const { rows: gapRows } = await pool.query(`
                                SELECT 1
                                FROM tenants t
                                LEFT JOIN tenant_leads l ON l.tenant_id = t.id
                                WHERE t.id = $1
                                  AND t.status IN ('active', 'live')
                                GROUP BY t.id
                                HAVING COUNT(l.id) = 0
                                    OR MAX(l.created_at) < NOW() - INTERVAL '3 days'
                            `, [tenant.id]);

                            if (gapRows.length > 0) {
                                await routineQueue.add('value_gap_checkin', {
                                    tenantId: tenant.id,
                                    routineType: 'value_gap_checkin',
                                }, { jobId: `value_gap_${tenant.id}_${today}`, removeOnComplete: true, removeOnFail: true });
                            }
                        } catch (gapErr) {
                            console.error(`[Cron] Value-gap check failed for tenant ${tenant.id}:`, gapErr);
                        }
                    }

                    // ── Feedback loop enforcement ──────────────────────────────────────
                    // Monday 8 AM UTC: weekly check-in
                    // Wednesday 8 AM UTC: reminder if no feedback since Monday
                    // Friday 8 AM UTC: pause if still no feedback
                    if (tenant.feedback_loop_enabled) {
                        const dayOfWeek = new Date().getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri
                        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                        const hasCheckedInThisWeek = tenant.last_feedback_at &&
                            new Date(tenant.last_feedback_at) > weekAgo;

                        if (!hasCheckedInThisWeek) {
                            if (dayOfWeek === 1 && nowHour === 8 && !tenant.feedback_reminder_sent_at) {
                                // Monday 8am — initial check-in
                                await routineQueue.add('weekly_checkin', {
                                    tenantId: tenant.id, routineType: 'weekly_checkin',
                                }, { jobId: `checkin_${tenant.id}_${today}`, removeOnComplete: true });
                            } else if (dayOfWeek === 3 && nowHour === 8 &&
                                tenant.feedback_reminder_sent_at === null && !tenant.feedback_paused) {
                                // Wednesday 8am — reminder
                                await routineQueue.add('feedback_reminder', {
                                    tenantId: tenant.id, routineType: 'feedback_reminder',
                                }, { jobId: `reminder_${tenant.id}_${today}`, removeOnComplete: true });
                            } else if (dayOfWeek === 5 && nowHour === 8 && !tenant.feedback_paused) {
                                // Friday 8am — pause
                                await routineQueue.add('feedback_pause', {
                                    tenantId: tenant.id, routineType: 'feedback_pause',
                                }, { jobId: `pause_${tenant.id}_${today}`, removeOnComplete: true });
                            }
                        }
                    }
                } catch (tenantErr) {
                    // Isolate per-tenant failures — other tenants continue processing
                    console.error(`[Cron] Failed to process tenant ${tenant.id}:`, tenantErr);
                }
            }

            console.log(`[Cron] Enqueued routine checks for ${tenants.length} active tenants (hour: ${nowHour} UTC).`);

            // ── Market Intelligence Mining — 2 AM UTC daily ───────────────────
            // One full Reddit harvest pass across all 15 active flavors.
            // Date-stamped jobId prevents duplicate runs within the same UTC day.
            if (nowHour === 2) {
                await miningQueue.add('global_market_mining', {}, {
                    jobId: `market_mining_${today}`,
                    removeOnComplete: true,
                    removeOnFail: true,
                });
                console.log(`[Cron] Enqueued daily market intelligence mining run.`);
            }

            // ── Platform key health check — 8 AM UTC daily ────────────────────
            // Validates that PLATFORM_ONBOARDING_KEY is live. This is the key
            // used as the fallback for all tenants who have not yet added their own key.
            // If it expires silently, every new signup gets a broken bot.
            if (nowHour === 8) {
                try {
                    const platformKey = process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;
                    if (!platformKey) {
                        console.error('[Cron] [ALERT] PLATFORM_ONBOARDING_KEY is not set!');
                        await sendAdminAlert(
                            '🚨 PLATFORM KEY MISSING\n' +
                            'PLATFORM_ONBOARDING_KEY env var is not set.\n' +
                            'All tenant fallback traffic will fail. Set it in GCP Secret Manager immediately.'
                        );
                    } else {
                        const { GoogleGenerativeAI } = await import('@google/generative-ai');
                        const genAI = new GoogleGenerativeAI(platformKey);
                        const healthModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
                        await healthModel.generateContent('ping');
                        console.log('[Cron] Platform key health check passed.');
                    }
                } catch (keyErr: any) {
                    console.error('[Cron] [ALERT] Platform key health check FAILED:', keyErr.message);
                    await sendAdminAlert(
                        '🚨 PLATFORM KEY HEALTH CHECK FAILED\n' +
                        'The platform onboarding key is expired or invalid.\n' +
                        `Error: ${keyErr.message}\n` +
                        'Action: renew the key in GCP Secret Manager and update the PLATFORM_ONBOARDING_KEY secret version.'
                    ).catch(() => {});
                }
            }
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

// ---------------------------------------------------------------------------
// Market Mining Worker
// ---------------------------------------------------------------------------

export const miningWorker = SHOULD_RUN_WORKERS ? new Worker(
    'market-mining',
    async () => {
        console.log('[Mining] Daily market intelligence run starting...');
        try {
            const { runMarketMining } = await import('./market_miner.js');
            const result = await runMarketMining();
            console.log(`[Mining] Run complete — flavors: ${result.flavorsProcessed}, posts: ${result.postsFound}, facts: ${result.factsSaved}`);
        } catch (err) {
            console.error('[Mining] Run failed:', err);
            throw err;
        }
    },
    { connection: connection as any, concurrency: 1 }
) : null;

if (miningWorker) {
    miningWorker.on('failed', (job, err) => {
        console.error(`[Mining] Job ${job?.id} failed:`, err?.message ?? err);
        sendAdminAlert(`⚠️ Market mining job failed\nJob: ${job?.id}\nError: ${err?.message ?? String(err)}`).catch(() => {});
    });
}

if (cronWorker) {
    cronWorker.on('failed', (job, err) => {
        console.error(`[Worker] Cron Job ${job?.id} TERMINAL FAILURE. Global heartbeat missed a cycle. Error:`, err?.message ?? err);
        // Cron failure = ALL tenants missed their routine cycle — this is critical
        sendAdminAlert(
            `🚨 GLOBAL HEARTBEAT TERMINAL FAILURE — entire routine cycle missed\nJob: ${job?.id}\nError: ${err?.message ?? String(err)}`
        ).catch(() => {});
    });

    // Schedule the global cron to run every minute ONLY if worker is initialized
    cronQueue.add('heartbeat', {}, {
        repeat: { pattern: '* * * * *' },
        jobId: 'global_heartbeat_cron' // ensures singleton
    }).catch(err => {
        console.error('[Queue] Failed to schedule global cron:', err);
    });
}
