import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { getTenant, getPool, getBotState, setBotState, getTenantBotToken } from './db.js';
import TelegramBot from 'node-telegram-bot-api';
import IORedis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { loadFlavorConfig } from '../tools/flavorConfig.js';
import { decryptToken } from './pool.js';

// Load all 19 tools — ALL must remain registered. Missing tool = infinite loop.
import { tiger_onboard }     from '../tools/tiger_onboard.js';
import { tiger_scout }       from '../tools/tiger_scout.js';
import { tiger_contact }     from '../tools/tiger_contact.js';
import { tiger_aftercare }   from '../tools/tiger_aftercare.js';
import { tiger_briefing }    from '../tools/tiger_briefing.js';
import { tiger_convert }     from '../tools/tiger_convert.js';
import { tiger_export }      from '../tools/tiger_export.js';
import { tiger_email }       from '../tools/tiger_email.js';
import { tiger_hive }        from '../tools/tiger_hive.js';
import { tiger_knowledge }   from '../tools/tiger_knowledge.js';
import { tiger_import }      from '../tools/tiger_import.js';
import { tiger_keys }        from '../tools/tiger_keys.js';
import { tiger_lead }        from '../tools/tiger_lead.js';
import { tiger_move }        from '../tools/tiger_move.js';
import { tiger_note }        from '../tools/tiger_note.js';
import { tiger_nurture }     from '../tools/tiger_nurture.js';
import { tiger_objection }   from '../tools/tiger_objection.js';
import { tiger_score }       from '../tools/tiger_score.js';
import { tiger_score_1to10 } from '../tools/tiger_score_1to10.js';
import { tiger_search }      from '../tools/tiger_search.js';
import { tiger_settings }    from '../tools/tiger_settings.js';
import { tiger_gmail_send, tiger_drive_list } from '../tools/tiger_google_workspace.js';

// ─── Safety constants ────────────────────────────────────────────────────────
// BUG 1 FIX: circuit breaker — prevents infinite tool loop if Gemini misbehaves
const MAX_TOOL_CALLS = 10;

// BUG 5 FIX: cap history size — prevents context window overflow for long-running tenants
// Each turn = 2 entries (user + model). 20 turns = 40 entries.
const MAX_HISTORY_TURNS = 20;

// ─── Tool registry ───────────────────────────────────────────────────────────
const toolsMap = {
    tiger_onboard,
    tiger_scout,
    tiger_contact,
    tiger_aftercare,
    tiger_briefing,
    tiger_convert,
    tiger_export,
    tiger_email,
    tiger_hive,
    tiger_knowledge,
    tiger_import,
    tiger_keys,
    tiger_lead,
    tiger_move,
    tiger_note,
    tiger_nurture,
    tiger_objection,
    tiger_score,
    tiger_score_1to10,
    tiger_search,
    tiger_settings,
    tiger_gmail_send,
    tiger_drive_list,
};
// Fix: Use STRICT @google/generative-ai Type enums to prevent silent JSON stripping
// standard OpenClaw JSON schema uses lowercase 'object', 'string'. We recursively map it here.
import { SchemaType } from '@google/generative-ai';

function mapToGoogleSchema(param: any): any {
    if (!param) return param;
    if (Array.isArray(param)) return param.map(mapToGoogleSchema);
    if (typeof param !== 'object') return param;
    
    const mapped = { ...param };
    if (mapped.type && typeof mapped.type === 'string') {
        const t = mapped.type.toLowerCase();
        if (t === 'object') mapped.type = SchemaType.OBJECT;
        else if (t === 'string') mapped.type = SchemaType.STRING;
        else if (t === 'array') mapped.type = SchemaType.ARRAY;
        else if (t === 'boolean') mapped.type = SchemaType.BOOLEAN;
        else if (t === 'number') mapped.type = SchemaType.NUMBER;
        else if (t === 'integer') mapped.type = SchemaType.INTEGER;
        else mapped.type = mapped.type.toUpperCase();
    }
    if (mapped.properties) {
        for (const [k, v] of Object.entries(mapped.properties)) {
            mapped.properties[k] = mapToGoogleSchema(v);
        }
    }
    if (mapped.items) {
        mapped.items = mapToGoogleSchema(mapped.items);
    }
    return mapped;
}

const geminiTools = [{
    functionDeclarations: Object.values(toolsMap).map((tool: any) => ({
        name: tool.name,
        description: tool.description,
        parameters: mapToGoogleSchema(tool.parameters),
    })),
}];

// ─── Redis ───────────────────────────────────────────────────────────────────
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) throw new Error("[FATAL] REDIS_URL environment variable is required");
const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
});

// ─── Chat history ────────────────────────────────────────────────────────────
export async function getTenantChatIds(tenantId: string): Promise<number[]> {
    const keys = await redis.keys(`chat_history:${tenantId}:*`);
    return keys.map(k => parseInt(k.split(':')[2], 10)).filter(id => !isNaN(id));
}

export async function getChatHistory(tenantId: string, chatId: number): Promise<Content[]> {
    try {
        const raw = await redis.get(`chat_history:${tenantId}:${chatId}`);
        if (!raw) return [];
        const history: Content[] = JSON.parse(raw);
        // Gemini requires history to start with role 'user'. If a trim previously cut mid-exchange,
        // a 'function' or 'model' role entry could be at position 0. Strip leading non-user entries.
        const firstUserIdx = history.findIndex(h => h.role === 'user');
        if (firstUserIdx < 0) return []; // no user entry at all — discard
        if (firstUserIdx > 0) {
            console.warn(`[AI] History for tenant ${tenantId} started with role '${history[0].role}' — trimming ${firstUserIdx} leading entries.`);
            return history.slice(firstUserIdx);
        }
        return history;
    } catch (err: any) {
        // BUG 3 FIX: loud failure — do not silently ignore
        console.error(`[AI] [ALERT] Failed to load chat history for tenant ${tenantId}:`, err.message);
        return []; // start fresh rather than crash
    }
}

export async function saveChatHistory(tenantId: string, chatId: number, history: Content[]): Promise<void> {
    // BUG 5 FIX: trim before saving — last MAX_HISTORY_TURNS turns kept
    // Also ensure trim always starts at a 'user' role boundary to prevent the
    // "First content should be with role 'user'" error on next load.
    let trimmed = history.slice(-(MAX_HISTORY_TURNS * 2));
    const firstUserIdx = trimmed.findIndex(h => h.role === 'user');
    if (firstUserIdx > 0) trimmed = trimmed.slice(firstUserIdx);
    await redis.set(
        `chat_history:${tenantId}:${chatId}`,
        JSON.stringify(trimmed),
        'EX',
        86400 * 7,
    );
}

// ─── Key resolution ──────────────────────────────────────────────────────────
/**
 * BUG 2 FIX: Resolves the active Google API key using the 4-layer system.
 *
 * Priority:
 *   1. key_state.json in tenant workdir (managed by tiger_keys tool) — authoritative
 *   2. DB bot_ai_config (BYOK set during onboarding, before key_state exists)
 *   3. Platform Layer 1 default (PLATFORM_ONBOARDING_KEY or GOOGLE_API_KEY)
 *
 * All failures are logged loudly with [ALERT] tag.
 * Wire [ALERT] logs to admin Telegram bot for production monitoring.
 */
export async function resolveGoogleKey(tenantId: string): Promise<string | undefined> {
    // Step 1 — tiger_keys state file (4-layer system source of truth)
    try {
        const state = await getBotState<any>(tenantId, 'key_state.json');
        if (state) {

            if (state.tenantPaused) {
                console.warn(`[AI] [ALERT] Tenant ${tenantId} is paused (key_state.json tenantPaused=true). No key issued.`);
                return undefined;
            }

            const activeLayer: number = state.activeLayer ?? 1;

            switch (activeLayer) {
                case 1:
                    return process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;

                case 2:
                    if (!state.layer2Key) {
                        console.error(`[AI] [ALERT] Tenant ${tenantId} is on Layer 2 but layer2Key is missing from key_state.json.`);
                    }
                    return state.layer2Key ? decryptToken(state.layer2Key) : undefined;

                case 3:
                    if (!state.layer3Key) {
                        console.error(`[AI] [ALERT] Tenant ${tenantId} is on Layer 3 but layer3Key is missing from key_state.json.`);
                    }
                    return state.layer3Key ? decryptToken(state.layer3Key) : undefined;

                case 4:
                    console.warn(`[AI] [ALERT] Tenant ${tenantId} on Layer 4 (platform emergency key). Operator action required.`);
                    return process.env.PLATFORM_EMERGENCY_KEY ?? process.env.GOOGLE_API_KEY;

                default:
                    console.error(`[AI] [ALERT] Tenant ${tenantId} has unknown activeLayer=${activeLayer} in key_state.json.`);
            }
        }
    } catch (err: any) {
        // BUG 3 FIX: was `catch (_)` — now loud
        console.error(`[AI] [ALERT] Failed to read key_state.json for tenant ${tenantId}:`, err.message);
    }

    // Step 2 — DB BYOK lookup (new tenant whose key_state hasn't been initialized yet)
    try {
        const pool = getPool();
        const configRes = await pool.query(
            `SELECT * FROM bot_ai_config
             WHERE tenant_id = $1`,
            [tenantId],
        );
        if (configRes.rows.length > 0) {
            const config = configRes.rows[0];
            if (config.provider === 'google' && config.encrypted_key) {
                const { decryptToken } = await import('./pool.js');
                return decryptToken(config.encrypted_key);
            }
        }
    } catch (err: any) {
        // BUG 3 FIX: was `catch (_)` — now loud
        console.error(`[AI] [ALERT] BYOK DB lookup failed for tenant ${tenantId}:`, err.message);
    }

    // Step 3 — Platform Layer 1 fallback (onboarding / new tenant)
    return process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;
}

// ─── Tool context ─────────────────────────────────────────────────────────────
function buildToolContext(tenantId: string, tenant: any) {
    const workdir = path.join(process.cwd(), 'data', tenantId);
    fs.mkdirSync(workdir, { recursive: true });
    return {
        sessionKey: tenantId,
        agentId: tenantId,
        workdir,
        config: {
            TIGER_CLAW_TENANT_ID: tenantId,
            TIGER_CLAW_TENANT_SLUG: tenant.slug,   // slug for tools that build API URLs
            BOT_FLAVOR: tenant.flavor,
            REGION: tenant.region,
            PREFERRED_LANGUAGE: tenant.language,
            TIGER_CLAW_API_URL: process.env.TIGER_CLAW_API_URL ?? (() => { throw new Error("[FATAL] TIGER_CLAW_API_URL environment variable is required"); })(),
        },
        abortSignal: new AbortController().signal,
        logger: console,
        storage: {
            get: (key: string) => getBotState(tenantId, key),
            set: (key: string, value: any) => setBotState(tenantId, key, value),
        },
    };
}

// ─── System prompt ────────────────────────────────────────────────────────────
// Async version — reads onboard_state.json so the bot has full operator context.
export async function buildSystemPrompt(tenant: any): Promise<string> {
    const flavor = loadFlavorConfig(tenant.flavor);

    // Load onboarding context — this is where all the operator identity and ICP data lives.
    // Admin-provisioned tenants (canaries) won't have this, so we degrade gracefully.
    let onboardState: any = null;
    try {
        onboardState = await getBotState<any>(tenant.id, 'onboard_state.json');
    } catch (_) {
        // Non-fatal — continue without it
    }

    const identity = onboardState?.identity ?? {};
    const icpBuilder = onboardState?.icpBuilder ?? {};
    const icpCustomer = onboardState?.icpCustomer ?? {};
    const icpSingle = onboardState?.icpSingle ?? {};
    const botName = onboardState?.botName ?? 'Tiger';
    const operatorName = identity.name ?? tenant.name ?? 'your operator';
    const hasOnboarding = onboardState?.phase === 'complete';

    // Build operator context block — only injected when onboarding is complete
    const operatorBlock = hasOnboarding ? [
        ``,
        `━━━━ OPERATOR IDENTITY (LOCKED — do not contradict these facts) ━━━━`,
        `Your name: ${botName}`,
        `Operator name: ${operatorName}`,
        `What they sell / represent: ${identity.productOrOpportunity ?? '—'}`,
        `Years in profession: ${identity.yearsInProfession ?? '—'}`,
        `Their biggest proven result: ${identity.biggestWin ?? '—'}`,
        `What makes them different: ${identity.differentiator ?? '—'}`,
        `Monthly income goal: ${identity.monthlyIncomeGoal ?? '—'}`,
        ``,
        `Use these facts naturally when you build credibility, handle objections, and represent the operator.`,
        `Never invent results or credentials that weren't provided above.`,
    ].join('\n') : [
        ``,
        `━━━━ OPERATOR CONTEXT ━━━━`,
        `Operator name: ${operatorName}`,
        `Note: This operator has not completed onboarding yet. Their product, ICP, and identity data are not yet available.`,
        `If they ask you to start scouting or pitching, first invite them to complete setup with tiger_onboard so you can represent them accurately.`,
        `For all other questions (strategy, training, advice), answer fully and intelligently based on your expertise.`,
    ].join('\n');

    // ICP block — injected when ICP data exists
    const icpLines: string[] = [];
    if (hasOnboarding) {
        const primaryIcp = onboardState?.flavor === 'network-marketer' ? icpBuilder : icpSingle;
        if (primaryIcp?.idealPerson) {
            const label = onboardState?.flavor === 'real-estate' ? 'Ideal Client' : 'Ideal Customer / Recruit';
            icpLines.push(``, `━━━━ IDEAL CUSTOMER PROFILE ━━━━`);
            icpLines.push(`${label}: ${primaryIcp.idealPerson}`);
            if (primaryIcp.problemFaced) icpLines.push(`Problem they face: ${primaryIcp.problemFaced}`);
            if (primaryIcp.currentApproachFailing) icpLines.push(`What's not working for them: ${primaryIcp.currentApproachFailing}`);
            if (primaryIcp.onlinePlatforms) icpLines.push(`Where they hang out online: ${primaryIcp.onlinePlatforms}`);
            if (primaryIcp.typesToAvoid) icpLines.push(`Types to avoid: ${primaryIcp.typesToAvoid}`);
        }
        if (onboardState?.flavor === 'network-marketer' && icpCustomer?.idealPerson) {
            icpLines.push(``, `Ideal Customer: ${icpCustomer.idealPerson}`);
            if (icpCustomer.problemFaced) icpLines.push(`Problem they face: ${icpCustomer.problemFaced}`);
            if (icpCustomer.onlinePlatforms) icpLines.push(`Where they hang out: ${icpCustomer.onlinePlatforms}`);
        }
    }

    return [
        `You are ${botName}, an elite, highly intelligent, and autonomous AI sales and recruiting consulting partner.`,
        `You are currently deployed to serve: ${operatorName}.`,
        `Industry flavor: ${flavor.name} (${flavor.professionLabel}).`,
        `Respond in: ${tenant.language ?? 'English'}.`,
        `Lead scoring threshold: 80 (LOCKED — never contact a prospect scoring below 80).`,
        `Key prospect keywords: ${flavor.defaultKeywords.slice(0, 8).join(', ')}.`,
        operatorBlock,
        ...icpLines,
        ``,
        `GLOBAL DIRECTIVE: You are NOT a rigid chatbot. You are a strategic, highly proactive business consultant. You possess deep knowledge of business, marketing, pipeline management, and scaling operations. You answer strategy questions intelligently. You do not just run tools; you think alongside your operator.`,
        ``,
        `VOICE & PERSONALITY:`,
        `Sound like a sharp, confident, and direct colleague. You are concise and high-agency.`,
        `Never hype. Never act like a cheerleader. State facts, execute tasks autonomously, and report succinctly.`,
        ``,
        `BANNED PHRASES — never generate any of these under any circumstances:`,
        `"crush it", "mouth closed business closed", "warm market", "warm circle of influence",`,
        `"your why", "what's the play", "what's the move", "let's get after it",`,
        `"manufacture some success", "hustle", "grind", "beast mode",`,
        `or any variation of classic network marketing scripts. These are permanently banned.`,
        ``,
        `HANDLING ONBOARDING ("tiger_onboard"):`,
        `- If a user wants to set up their Ideal Customer Profile (ICP), establish their product, or define their search algorithms, ONLY THEN do you call tiger_onboard(action="start").`,
        `- If the user is actively answering your onboarding questions, call tiger_onboard(action="respond", response=<user message>).`,
        `- Otherwise, ALLOW ORGANIC CONVERSATION. Do not stall them. They can chat, ask questions, or command you freely.`,
        ``,
        `AUTONOMOUS TOOL EXECUTION (19 CAPABILITIES):`,
        `- You possess 19 powerful tools. When the user's organic request matches a capability, execute it silently.`,
        `- Build Pipeline / Find leads / Scan social networks / Hunt → call tiger_scout(action="hunt", mode="burst")`,
        `- Daily Report / Morning Briefing / Who to contact → call tiger_briefing`,
        `- Research a specific prospect/name / Look up someone → call tiger_search`,
        `- Message a prospect / Reach out / Pitch → call tiger_contact`,
        `- Follow-up on a response / Prospect replied → call tiger_aftercare`,
        `- Add a note about a contact → call tiger_note`,
        `- Report a win / Mark as Sign-up / Set as converted → call tiger_convert`,
        `- Check pipeline status / Lead count → call tiger_scout(action="status")`,
        ``,
        `CRITICAL TELEMETRY (ALWAYS EXECUTE WHEN APPROPRIATE):`,
        `- After every outbound prospect message or significant AI tool result, call tiger_keys(action="record_message") to track token limits.`,
        `- If an API errors out, call tiger_keys(action="report_error", error=status) so the DevOps layer is notified.`,
        ``,
        `ANTI-CHURN CRITICAL RULE:`,
        `If tiger_scout returns 0 leads or an empty pipeline, NEVER tell the user to "work their warm market" or "talk to friends/family".`,
        `Instead, assure them that you are actively recalibrating the search algorithms, scanning new channels, and dynamically adjusting to uncover hidden pockets of qualified leads. Reassure them of your autonomous persistence.`,
    ].join('\n');
}

// ─── Tool execution loop ─────────────────────────────────────────────────────
async function runToolLoop(
    chat: any,
    initialResponse: any,
    toolContext: any,
    logPrefix: string,
): Promise<any> {
    let response = initialResponse;
    let toolCallCount = 0;

    while ((response.functionCalls?.() ?? []).length > 0) {
        // BUG 1 FIX: circuit breaker
        if (toolCallCount >= MAX_TOOL_CALLS) {
            console.error(
                `[${logPrefix}] [ALERT] Circuit breaker: ${toolCallCount} tool calls reached for tenant ${toolContext.agentId}. Aborting loop.`,
            );
            break;
        }

        const calls = response.functionCalls()!;
        const functionResponses: Part[] = [];

        for (const fc of calls) {
            toolCallCount++;
            console.log(`[${logPrefix}] Tool (${toolCallCount}/${MAX_TOOL_CALLS}): ${fc.name}`);

            const tool = toolsMap[fc.name as keyof typeof toolsMap];
            let toolResult: any;

            if (!tool) {
                // Unknown tool — Gemini hallucinated a tool name
                console.error(`[${logPrefix}] [ALERT] Unknown tool called: "${fc.name}" — not in toolsMap`);
                toolResult = { error: `Unknown tool "${fc.name}". Only registered tools may be called.` };
            } else {
                try {
                    toolResult = await tool.execute(fc.args, toolContext);
                } catch (toolErr: any) {
                    console.error(`[${logPrefix}] Tool ${fc.name} threw:`, toolErr.message);
                    toolResult = { error: toolErr.message };
                }
            }

            functionResponses.push({
                functionResponse: { name: fc.name, response: toolResult },
            } as any);
        }

        const nextResult = await chat.sendMessage(functionResponses);
        response = nextResult.response;
    }

    return response;
}

// ─── Public: process a Telegram user message ─────────────────────────────────
export async function processTelegramMessage(
    tenantId: string,
    botToken: string,
    chatId: number,
    text: string,
) {
    const bot = new TelegramBot(botToken);
    const tenant = await getTenant(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    try {
        const toolContext = buildToolContext(tenantId, tenant);
        const googleKey = await resolveGoogleKey(tenantId);

        if (!googleKey) {
            console.warn(`[AI] No Google key resolved for tenant ${tenantId} — sending paused message.`);
            await bot.sendMessage(
                chatId,
                '⚠️ Your bot is paused. Please contact support or add your API key to reactivate.',
            );
            return;
        }

        console.log(`[AI] Key resolved for tenant ${tenantId}. Entering Gemini pipeline for chat ${chatId}.`);

        await bot.sendChatAction(chatId, 'typing');
        console.log(`[AI] sendChatAction OK for chat ${chatId}`);

        const history = await getChatHistory(tenantId, chatId);
        console.log(`[AI] History loaded: ${history.length} entries`);

        const genAI = new GoogleGenerativeAI(googleKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        });

        const chat = model.startChat({ history });
        console.log(`[AI] Sending message to Gemini: "${text.slice(0, 50)}"`);
        const initial = await chat.sendMessage(text);
        const initCandidates = (initial.response as any).candidates ?? [];
        const finishReason = initCandidates[0]?.finishReason ?? 'unknown';
        const promptBlocked = (initial.response as any).promptFeedback?.blockReason ?? null;
        const rawParts = initCandidates[0]?.content?.parts ?? [];
        console.log(`[AI] Gemini initial response: finishReason=${finishReason}, promptBlocked=${promptBlocked}, text=${!!initial.response.text?.()}, toolCalls=${(initial.response.functionCalls?.() ?? []).length}, rawParts=${JSON.stringify(rawParts).slice(0, 300)}`);
        const finalResponse = await runToolLoop(chat, initial.response, toolContext, 'AI');

        const updatedHistory = await chat.getHistory();
        await saveChatHistory(tenantId, chatId, updatedHistory);
        console.log(`[AI] History saved: ${updatedHistory.length} entries`);

        const replyText = finalResponse.text?.() ?? '';
        console.log(`[AI] Reply text length: ${replyText.trim().length}. Sending to Telegram.`);
        if (replyText.trim().length > 0) {
            await bot.sendMessage(chatId, replyText);
            console.log(`[AI] Message sent to chat ${chatId}`);
        } else {
            console.warn(`[AI] [ALERT] Gemini returned empty reply for tenant ${tenantId} chat ${chatId}`);
        }
    } catch (err: any) {
        console.error(`[AI] [ALERT] processTelegramMessage failed for tenant ${tenantId}:`, err.message);
        // Do not expose internal error details to the customer
        await bot.sendMessage(
            chatId,
            '❌ Something went wrong. The operator has been notified. Please try again in a moment.',
        );
    }
}

// ─── Public: process a background system routine ──────────────────────────────
export async function processSystemRoutine(tenantId: string, routineType: string) {
    const tenant = await getTenant(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    try {
        const toolContext = buildToolContext(tenantId, tenant);
        const googleKey = await resolveGoogleKey(tenantId);

        if (!googleKey) {
            console.warn(`[AI Routine] [ALERT] No API key for tenant ${tenantId}. Aborting ${routineType}.`);
            return;
        }

        // System routines always start with a clean history. Persisting routine
        // chat history causes the next run to start with a 'function' role message
        // (from the previous run's tool responses), which Gemini rejects.
        const genAI = new GoogleGenerativeAI(googleKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        });

        const systemPrompts: Record<string, string> = {
            daily_scout:   'SYSTEM: Run your Daily Scout routine. Find new leads to contact.',
            nurture_check: 'SYSTEM: Run your Nurture Check. Review follow-ups and reach out where due.',
            trial_reminder_24h: `SYSTEM: Write a 1-sentence, highly conversational Telegram message to your operator reminding them they have 48 hours left on their free trial. Tell them to securely plug in their API key at https://app.tigerclaw.io so you don't have to stop working for them. Use your exact flavor and personality. NEVER use placeholders. Do NOT execute any tools.`,
            trial_reminder_48h: `SYSTEM: Write a 1-sentence, highly conversational Telegram message to your operator reminding them they have 24 hours left on their free trial. Tell them to securely plug in their API key at https://app.tigerclaw.io so you don't have to stop working for them. Use your exact flavor and personality. NEVER use placeholders. Do NOT execute any tools.`,
            trial_reminder_72h: `SYSTEM: Write a 1-sentence, highly conversational Telegram message to your operator telling them their 72-hour free trial is officially complete, and you have paused your operations so their flywheel has stopped. Tell them to unlock their bot to resume scouting. Use your exact flavor and personality. NEVER use placeholders. Do NOT execute any tools.`,
        };
        const prompt = systemPrompts[routineType] ?? `SYSTEM: Execute routine: ${routineType}`;

        const chat = model.startChat({ history: [] });
        const initial = await chat.sendMessage(prompt);
        
        // Trial Reminder Handling — extract text and broadcast entirely securely
        if (routineType.startsWith('trial_reminder_')) {
            let finalResponse = initial.response.text?.() ?? '';
            if (finalResponse) {
                if (routineType === 'trial_reminder_72h') {
                    const stanStoreUrl = process.env.STAN_STORE_URL;
                    if (stanStoreUrl) {
                        finalResponse += `\n\nTo unlock your bot and resume operations, complete your registration here: ${stanStoreUrl}`;
                    }
                }
                const botToken = await getTenantBotToken(tenantId);
                if (botToken) {
                    const chatIds = await getTenantChatIds(tenantId);
                    const bot = new TelegramBot(botToken);
                    for (const cid of chatIds) {
                        await bot.sendMessage(cid, finalResponse).catch(err => 
                            console.error(`[AI Routine] Failed to send reminder to ${cid}:`, err.message)
                        );
                    }
                }
                if (routineType === 'trial_reminder_72h') {
                    const botState = JSON.parse(await getBotState(tenantId, 'key_state.json') || '{}');
                    botState.tenantPaused = true;
                    await setBotState(tenantId, 'key_state.json', botState);
                }
            }
        } else {
            // Standard tool loop for Nurture/Scouting
            await runToolLoop(chat, initial.response, toolContext, `AI Routine:${routineType}`);
        }

        console.log(`[AI Routine] ${routineType} complete for tenant ${tenantId}.`);
    } catch (err: any) {
        console.error(`[AI Routine] [ALERT] ${routineType} failed for tenant ${tenantId}:`, err.message);
    }
}

// ─── Public: process a LINE user message ─────────────────────────────────────
// LINE Push API is used (not Reply API) because the message is processed
// asynchronously via BullMQ — the 30-second replyToken window is too short.
export async function processLINEMessage(
    tenantId: string,
    encryptedChannelAccessToken: string,
    userId: string,
    text: string,
) {
    const channelAccessToken = decryptToken(encryptedChannelAccessToken);

    const sendLineMessage = async (message: string) => {
        try {
            const resp = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${channelAccessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: userId,
                    messages: [{ type: 'text', text: message.slice(0, 5000) }],
                }),
            });
            if (!resp.ok) {
                console.error(`[AI] LINE push API error ${resp.status} for tenant ${tenantId}:`, await resp.text());
            }
        } catch (err) {
            console.error(`[AI] Failed to send LINE message to ${userId}:`, err);
        }
    };

    const tenant = await getTenant(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

    const toolContext = buildToolContext(tenantId, tenant);
    const googleKey = await resolveGoogleKey(tenantId);

    if (!googleKey) {
        await sendLineMessage('⚠️ Your bot is paused. Please contact support or add your API key to reactivate.');
        return;
    }

    // Use LINE userId as chatId for per-user history (stored as string in Redis key)
    const chatId = userId as unknown as number;

    try {
        const history = await getChatHistory(tenantId, chatId);
        const genAI = new GoogleGenerativeAI(googleKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        });

        const chat = model.startChat({ history });
        const initial = await chat.sendMessage(text);
        const finalResponse = await runToolLoop(chat, initial.response, toolContext, 'AI');

        const updatedHistory = await chat.getHistory();
        await saveChatHistory(tenantId, chatId, updatedHistory);

        const replyText = finalResponse.text?.() ?? '';
        if (replyText.trim().length > 0) {
            await sendLineMessage(replyText);
        }
    } catch (err: any) {
        console.error(`[AI] [ALERT] processLINEMessage failed for tenant ${tenantId}:`, err.message);
        await sendLineMessage('❌ Something went wrong. The operator has been notified. Please try again in a moment.');
    }
}
