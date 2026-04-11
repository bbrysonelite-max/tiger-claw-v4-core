import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { provisionTenant } from './provisioner.js'; // Multi-tenant provisioner
import { getPool, getTenantBotUsername, updateTenantKeyHealth } from './db.js';
import { sendAdminAlert } from '../routes/admin.js';
import { sendProvisioningReceipt } from './email.js';
import { resolveAIProvider, validateAIKey } from './ai.js';
import TelegramBot from 'node-telegram-bot-api';

// Provide a stable connection to our newly provisioned Memorystore Redis
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("[FATAL] REDIS_URL environment variable is required");
export const connection = new IORedis(redisUrl, {
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

export const marketIntelligenceQueue = new Queue('market-intelligence-batch', { connection: connection as any });
console.log('[Queue] BullMQ market-intelligence-batch queue configured.');

// Stan Store pre-sale setup queue — creates DB records + sends magic link email.
// Kept separate from tenant-provisioning (which attaches the Telegram webhook)
// because the customer triggers provisioning later via the wizard.
export const onboardingQueue = new Queue('stan-store-onboarding', {
    connection: connection as any,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnFail: false, // keep failed jobs for inspection — paying customer data
    },
});
console.log('[Queue] BullMQ stan-store-onboarding queue configured.');

export interface OnboardingJobData {
    email: string;
    name: string;
    slug: string;
    flavor: string;
    language: string;
    region: string;
    timezone: string;
    preferredChannel: string;
    stripeSessionId: string;
    stripeSubscriptionId?: string;
    preBotId?: string | null;
    preUserId?: string | null;
    stripeCustomerId?: string | null;
}

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
    botToken?: string; // BYOB: Telegram tenants must provide their own token
    botUsername?: string;
    timezone?: string;
}

const SHOULD_RUN_WORKERS = process.env.ENABLE_WORKERS === 'true';

// Background worker that provisions the tenant state and sets up webhook listeners
export const provisionWorker = SHOULD_RUN_WORKERS ? new Worker(
    'tenant-provisioning',
    async (job: Job<ProvisionJobData>) => {
        console.log(`[Worker] Started provisioning job ${job.id} for slug: ${job.data.slug}`);

        try {
            const result = await provisionTenant({
                slug: job.data.slug,
                name: job.data.name,
                email: job.data.email,
                flavor: job.data.flavor,
                region: job.data.region,
                language: job.data.language,
                preferredChannel: job.data.preferredChannel,
                botToken: job.data.botToken,
                botUsername: job.data.botUsername,
                timezone: job.data.timezone,
                botId: job.data.botId,
            });

            if (!result.success) {
                throw new Error(`Tenant provisioning failed for ${job.data.slug}: ${result.error}`);
            }

            console.log(`[Worker] Succeeded provisioning job ${job.id}. Tenant live.`);

            const pool = getPool();
            await pool.query("UPDATE tenants SET status = 'live' WHERE id = $1", [job.data.botId]);

            await sendAdminAlert(
                `✅ New tenant provisioned via Queue (Blowout Protection)!\n` +
                `Name: ${job.data.name}\nSlug: ${job.data.slug}\nFlavor: ${job.data.flavor}\n`
            );

            if (job.data.email && result.tenant?.id) {
                const botUsername = await getTenantBotUsername(result.tenant.id);
                await sendProvisioningReceipt(job.data.email, job.data.name, botUsername, job.data.flavor);
            }

            return result;
        } catch (error) {
            console.error(`[Worker] Error on provisioning job ${job.id} (attempt ${job.attemptsMade}):`, error);
            throw error; // Let BullMQ retry — status update happens only on terminal failure
        }
    },
    {
        connection: connection as any,
        concurrency: 10,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 60000,
        limiter: { max: 50, duration: 60000 },
    }
) : null;

if (provisionWorker) {
    // 'failed' fires only after ALL retries are exhausted — terminal failure only
    provisionWorker.on('failed', (job, err) => {
        console.error(`[Worker] Provisioning Job ${job?.id} TERMINAL FAILURE (all retries exhausted). Error:`, err);
        // Mark tenant as error only on terminal failure — not on transient retries
        if (job?.data?.botId) {
            getPool().query("UPDATE tenants SET status = 'error' WHERE id = $1", [job.data.botId]).catch(() => {});
        }
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

                // Slash command fast-path — intercept before Gemini
                const { handleSlashCommand } = await import('./slashCommands.js');
                const handled = await handleSlashCommand(tenantId, botToken, chatId, text);
                if (handled) return { success: true };

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
        concurrency: 50,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 30000,
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
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 30000,
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
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 60000,
    }
) : null;

if (emailWorker) {
    emailWorker.on('failed', (job, err) => {
        console.error(`[Worker] Email support job ${job?.id} TERMINAL FAILURE (from: ${job?.data?.fromEmail ?? 'unknown'}). Error:`, err?.message ?? err);
        sendAdminAlert(
            `⚠️ Email support TERMINAL FAILURE\nFrom: ${job?.data?.fromEmail ?? 'unknown'}\nSubject: ${job?.data?.subject ?? 'unknown'}\nError: ${err?.message ?? String(err)}`
        ).catch(() => {});
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
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 30000,
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
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 60000,
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
                SELECT id, name, created_at, feedback_loop_enabled, feedback_paused,
                       last_feedback_at, feedback_reminder_sent_at, feedback_pause_sent_at,
                       key_health, bot_token
                FROM tenants WHERE status IN ('active', 'live', 'onboarding')
            `);

            const nowHour = new Date().getUTCHours();
            const today = new Date().toISOString().split('T')[0];

            const { getBotState } = await import('./db.js');

            for (const tenant of tenants) {
                try {
                    // Skip AI routines for tenants still in bot calibration (onboarding).
                    // nurture_check / daily_scout calling tiger_onboard mid-calibration
                    // corrupts the onboarding state and burns the user's API quota.
                    const onboardState = await getBotState<{ phase?: string }>(tenant.id, 'onboard_state.json');
                    const onboardComplete = !onboardState || onboardState.phase === 'complete';
                    if (!onboardComplete) continue;

                    // Nurture check — runs every cron cycle (jobId dedup prevents parallel runs)
                    // Skip if tenant has no leads — avoids burning LLM tokens on an empty pipeline
                    const { rows: leadRows } = await pool.query(
                        `SELECT 1 FROM tenant_leads WHERE tenant_id = $1 LIMIT 1`,
                        [tenant.id]
                    );
                    if (leadRows.length > 0) {
                        await routineQueue.add('nurture_check', {
                            tenantId: tenant.id,
                            routineType: 'nurture_check',
                        }, { jobId: `nurture_${tenant.id}`, removeOnComplete: true, removeOnFail: { count: 100 } });
                    }

                    // daily_scout runs once per day at 7 AM UTC (date-stamped jobId prevents re-add)
                    if (nowHour === 7) {
                        await routineQueue.add('daily_scout', {
                            tenantId: tenant.id,
                            routineType: 'daily_scout',
                        }, { jobId: `scout_${tenant.id}_${today}`, removeOnComplete: true, removeOnFail: { count: 100 } });
                    }

                    // ── Key Health Monitor — runs every hour ─────────────────────────
                    // Job 2: Lightweight validation ping against the tenant's AI key.
                    // Only checks tenants with a configured BYOK key.
                    const aiProvider = await resolveAIProvider(tenant.id);
                    if (aiProvider && aiProvider.key && !aiProvider.key.startsWith('AIzaSyD')) { // Only BYOK, skip platform key
                        const { valid, error: keyErr } = await validateAIKey(aiProvider.provider, aiProvider.key);
                        const currentHealth = valid ? 'healthy' : 'dead';
                        
                        if (tenant.key_health !== currentHealth) {
                            console.log(`[Cron] Key health change for ${tenant.id}: ${tenant.key_health} -> ${currentHealth} (${keyErr ?? 'OK'})`);
                            await updateTenantKeyHealth(tenant.id, currentHealth);

                            if (currentHealth === 'dead') {
                                await sendAdminAlert(`🔑 Dead key — tenant *${tenant.slug}* (${tenant.email})\nProvider: ${aiProvider.provider}\nError: ${keyErr ?? 'Unauthorized'}\nDashboard: ${process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io'}/dashboard?slug=${tenant.slug}`);
                            }
                        }
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
                                LEFT JOIN tenant_leads l ON l.tenant_id = t.id::text
                                WHERE t.id = $1
                                  AND t.status IN ('active', 'live', 'onboarding')
                                GROUP BY t.id
                                HAVING COUNT(l.id) = 0
                                    OR MAX(l.created_at) < NOW() - INTERVAL '3 days'
                            `, [tenant.id]);

                            if (gapRows.length > 0) {
                                await routineQueue.add('value_gap_checkin', {
                                    tenantId: tenant.id,
                                    routineType: 'value_gap_checkin',
                                }, { jobId: `value_gap_${tenant.id}_${today}`, removeOnComplete: true, removeOnFail: { count: 100 } });
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

            // ── Orchestrated Agent Pipeline — 2 AM UTC daily ─────────────────
            // Spawns Research Agent fleet (parallel, one per flavor) then
            // Reporting Agent. Replaces the legacy sequential market_miner.
            if (nowHour === 2) {
                const { startOrchestratedRun } = await import('./orchestrator.js');
                await startOrchestratedRun(`run_${today}`);
                console.log(`[Cron] Daily orchestrated run started (runId: run_${today})`);
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
                        const { callGemini } = await import('./geminiGateway.js');
                        await callGemini(() => healthModel.generateContent('ping'));
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
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 120000,
    }
) : null;

// ---------------------------------------------------------------------------
// Market Mining Worker
// ---------------------------------------------------------------------------

export const miningWorker = SHOULD_RUN_WORKERS ? new Worker(
    'market-mining',
    async (job: Job) => {
        const runId = job.id ?? `mine_${Date.now()}`;
        console.log(`[Mining] Daily market intelligence run starting (runId: ${runId})...`);
        const { logAdminEvent } = await import('./db.js');
        await logAdminEvent('mine_started', undefined, { runId }).catch(() => {});
        try {
            const { runMarketMining } = await import('./market_miner.js');
            const result = await runMarketMining();
            console.log(`[Mining] Run complete — flavors: ${result.flavorsProcessed}, posts: ${result.postsFound}, facts: ${result.factsSaved}`);
            await logAdminEvent('mine_complete', undefined, {
                runId,
                flavorsProcessed: result.flavorsProcessed,
                postsFound: result.postsFound,
                factsSaved: result.factsSaved,
            }).catch(() => {});
        } catch (err) {
            console.error('[Mining] Run failed:', err);
            await logAdminEvent('mine_failed', undefined, { runId, error: String(err) }).catch(() => {});
            throw err;
        }
    },
    {
        connection: connection as any,
        concurrency: 1,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 600000, // mining runs can take minutes
    }
) : null;

if (miningWorker) {
    miningWorker.on('failed', (job, err) => {
        console.error(`[Mining] Job ${job?.id} failed:`, err?.message ?? err);
        sendAdminAlert(`⚠️ Market mining job failed\nJob: ${job?.id}\nError: ${err?.message ?? String(err)}`).catch(() => {});
    });
}

// ---------------------------------------------------------------------------
// Orchestrator Worker — coordinates the daily agent pipeline
// ---------------------------------------------------------------------------

export const orchestratorWorker = SHOULD_RUN_WORKERS ? new Worker(
    'tiger-orchestrator',
    async (job: Job) => {
        const { runId, triggeredAt } = job.data;
        console.log(`[Orchestrator] Job received — runId: ${runId}, triggered: ${triggeredAt}`);
        const { startOrchestratedRun } = await import('./orchestrator.js');
        await startOrchestratedRun(runId);
    },
    {
        connection: connection as any,
        concurrency: 1,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 60000,
    }
) : null;

if (orchestratorWorker) {
    orchestratorWorker.on('failed', (job, err) => {
        console.error(`[Orchestrator] Job ${job?.id} failed:`, err?.message ?? err);
        sendAdminAlert(`🚨 Orchestrator job failed\nJob: ${job?.id}\nError: ${err?.message ?? String(err)}`).catch(() => {});
    });
}

// ---------------------------------------------------------------------------
// Research Agent Worker — per-flavor parallel market intelligence mining
// ---------------------------------------------------------------------------

export const researchAgentWorker = SHOULD_RUN_WORKERS ? new Worker(
    'research-agent',
    async (job: Job) => {
        const { runId, flavorId, displayName, queries, prospectProfile } = job.data;
        console.log(`[ResearchAgent] Job received — flavor: ${displayName}, run: ${runId}`);
        const { runResearchAgent } = await import('./research_agent.js');
        const result = await runResearchAgent(runId, flavorId, displayName, queries, prospectProfile);
        return result;
    },
    {
        connection: connection as any,
        concurrency: 8,          // 8 flavors run in parallel
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 300000,    // 5 min max per flavor
    }
) : null;

if (researchAgentWorker) {
    // On terminal failure: report 0 facts to orchestrator so it doesn't hang waiting for this flavor.
    researchAgentWorker.on('failed', (job, err) => {
        const flavor = job?.data?.displayName ?? 'unknown';
        const runId = job?.data?.runId;
        console.error(`[ResearchAgent] Job failed for flavor ${flavor}:`, err?.message ?? err);
        if (runId) {
            import('./orchestrator.js').then(({ reportResearchComplete }) => {
                reportResearchComplete(runId, 0).catch(() => {});
            }).catch(() => {});
        }
    });

    // On stall: same — report 0 facts so the pipeline can proceed.
    researchAgentWorker.on('stalled', (jobId) => {
        console.warn(`[ResearchAgent] Job ${jobId} stalled — pipeline will proceed without this flavor`);
    });
}

// ---------------------------------------------------------------------------
// Reporting Agent Worker — daily intelligence brief
// ---------------------------------------------------------------------------

export const reportingAgentWorker = SHOULD_RUN_WORKERS ? new Worker(
    'reporting-agent',
    async (job: Job) => {
        const { runId, startedAt, flavorsProcessed } = job.data;
        console.log(`[ReportingAgent] Job received — run: ${runId}`);
        const { runReportingAgent } = await import('./reporting_agent.js');
        await runReportingAgent(runId, startedAt, flavorsProcessed);
    },
    {
        connection: connection as any,
        concurrency: 1,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 120000,
    }
) : null;

if (reportingAgentWorker) {
    reportingAgentWorker.on('failed', (job, err) => {
        console.error(`[ReportingAgent] Job ${job?.id} failed:`, err?.message ?? err);
        sendAdminAlert(`⚠️ Reporting Agent failed\nJob: ${job?.id}\nError: ${err?.message ?? String(err)}`).catch(() => {});
    });
}

// Stan Store pre-sale setup worker
// Creates user + bot + subscription DB records, then sends magic link email.
// Runs in us-central1 only (ENABLE_WORKERS=true). Retries 5x with exponential backoff
// so a transient DB blip or Resend API hiccup doesn't orphan a paying customer.
export const onboardingWorker = SHOULD_RUN_WORKERS ? new Worker(
    'stan-store-onboarding',
    async (job: Job<OnboardingJobData>) => {
        const { email, name, slug, flavor, stripeSessionId, stripeSubscriptionId, preBotId, stripeCustomerId } = job.data;
        console.log(`[Onboarding] Processing Stan Store setup for ${email} (session: ${stripeSessionId})`);

        const { createBYOKUser, createBYOKBot, createBYOKSubscription, logAdminEvent } = await import('./db.js');
        const { sendStanStoreWelcome } = await import('./email.js');

        const userId = await createBYOKUser(email, name, stripeCustomerId ?? undefined);
        const botId = (preBotId && preBotId !== 'pending') ? preBotId : await createBYOKBot(userId, name, flavor, 'pending');

        if (stripeSubscriptionId) {
            await createBYOKSubscription({
                userId,
                botId,
                stripeSubscriptionId,
                planTier: 'byok_basic',
            });
        }

        await logAdminEvent('stan_store_purchase', botId, { email, slug, sessionId: stripeSessionId });
        await sendStanStoreWelcome(email, name);

        console.log(`[Onboarding] ✅ Stan Store setup complete for ${email} — botId: ${botId}`);
        return { botId };
        },
    {
        connection: connection as any,
        concurrency: 5,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 60000,
    }
) : null;

export const marketIntelligenceWorker = SHOULD_RUN_WORKERS ? new Worker(
    'market-intelligence-batch',
    async (job: Job) => {
        const fact = job.data;
        const { saveMarketFact } = await import('./market_intel.js');
        await saveMarketFact(fact);
        return { success: true };
    },
    {
        connection: connection as any,
        concurrency: 10,
        stalledInterval: 30000,
        maxStalledCount: 3,
        lockDuration: 30000,
        limiter: { max: 100, duration: 1000 },
    }
) : null;

if (marketIntelligenceWorker) {
    marketIntelligenceWorker.on('failed', (job, err) => {
        console.error(`[Worker] Market Intelligence batch job ${job?.id} failed:`, err);
        sendAdminAlert(
            `⚠️ Market intelligence batch TERMINAL FAILURE\nJob: ${job?.id}\nError: ${err?.message ?? String(err)}`
        ).catch(() => {});
    });
}

if (onboardingWorker) {
    onboardingWorker.on('failed', (job, err) => {
        console.error(`[Onboarding] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err?.message ?? err);
        // Alert only on terminal failure (all retries exhausted)
        if ((job?.attemptsMade ?? 0) >= 5) {
            const data = job?.data as OnboardingJobData | undefined;
            sendAdminAlert(
                `🚨 Stan Store onboarding TERMINAL FAILURE — customer has no account\nEmail: ${data?.email}\nSession: ${data?.stripeSessionId}\nError: ${err?.message ?? String(err)}`
            ).catch(() => {});
        }
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
