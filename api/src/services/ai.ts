import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import OpenAI from 'openai';
import { getTenant, getPool, getBotState, setBotState, getTenantBotToken, getHiveSignalWithFallback, queryHivePatterns } from './db.js';
import TelegramBot from 'node-telegram-bot-api';
import IORedis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { loadFlavorConfig } from '../tools/flavorConfig.js';
import { decryptToken } from './pool.js';
import { draftSkillFromFailure, loadApprovedSkills } from './self-improvement.js';
import { hiveAttributionLabel } from './hiveEmitter.js';

// Load all 19 tools — ALL must remain registered. Missing tool = infinite loop.
import { tiger_onboard }     from '../tools/tiger_onboard.js';
import { tiger_scout }       from '../tools/tiger_scout.js';
import { tiger_contact }     from '../tools/tiger_contact.js';
import { tiger_aftercare }   from '../tools/tiger_aftercare.js';
import { tiger_briefing }    from '../tools/tiger_briefing.js';
import { tiger_convert }     from '../tools/tiger_convert.js';
import { tiger_export }      from '../tools/tiger_export.js';
import { tiger_email }       from '../tools/tiger_email.js';
import { sendTrialReminderEmail } from './email.js';
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

export async function clearTenantChatHistory(tenantId: string): Promise<number> {
    const keys = await redis.keys(`chat_history:${tenantId}:*`);
    if (keys.length === 0) return 0;
    await redis.del(...keys);
    console.log(`[AI] Cleared ${keys.length} chat history keys for tenant ${tenantId}.`);
    return keys.length;
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

// ─── Multi-provider resolution ────────────────────────────────────────────────

export type AIProvider = {
    key: string;
    provider: 'google' | 'openai';
    model: string;
};

function detectProvider(key: string): 'google' | 'openai' | null {
    if (key.startsWith('AIza')) return 'google';
    if (key.startsWith('sk-')) return 'openai';
    return null;
}

function defaultModel(provider: 'google' | 'openai'): string {
    return provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash';
}

/**
 * Resolves the active AI provider + key for a tenant.
 * Returns { key, provider, model } or undefined if tenant is paused / no key available.
 *
 * Resolution order mirrors resolveGoogleKey but is provider-agnostic:
 *   1. key_state.json (layer 1-4, Google platform keys)
 *   2. bot_ai_config DB (BYOK — any provider)
 *   3. Platform fallback (Google)
 */
export async function resolveAIProvider(tenantId: string): Promise<AIProvider | undefined> {
    // Step 1 — key_state.json (Google platform keys, 4-layer system)
    try {
        const state = await getBotState<any>(tenantId, 'key_state.json');
        if (state) {
            if (state.tenantPaused) {
                console.warn(`[AI] [ALERT] Tenant ${tenantId} is paused. No key issued.`);
                return undefined;
            }
            const activeLayer: number = state.activeLayer ?? 1;
            let rawKey: string | undefined;
            switch (activeLayer) {
                case 1: rawKey = process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY; break;
                case 2: rawKey = state.layer2Key ? decryptToken(state.layer2Key) : undefined; break;
                case 3: rawKey = state.layer3Key ? decryptToken(state.layer3Key) : undefined; break;
                case 4: rawKey = process.env.PLATFORM_EMERGENCY_KEY ?? process.env.GOOGLE_API_KEY; break;
            }
            if (rawKey) {
                const provider = detectProvider(rawKey) ?? 'google';
                return { key: rawKey, provider, model: state.layer2Model ?? defaultModel(provider) };
            }
        }
    } catch (err: any) {
        console.error(`[AI] [ALERT] resolveAIProvider key_state read failed for ${tenantId}:`, err.message);
    }

    // Step 2 — bot_ai_config DB (BYOK, any provider)
    try {
        const pool = getPool();
        const res = await pool.query(
            `SELECT provider, model, encrypted_key FROM bot_ai_config WHERE tenant_id = $1`,
            [tenantId],
        );
        if (res.rows.length > 0) {
            const { provider, model, encrypted_key } = res.rows[0];
            if (encrypted_key) {
                const key = decryptToken(encrypted_key);
                const resolvedProvider = (provider as 'google' | 'openai') ?? detectProvider(key) ?? 'google';
                return { key, provider: resolvedProvider, model: model ?? defaultModel(resolvedProvider) };
            }
        }
    } catch (err: any) {
        console.error(`[AI] [ALERT] resolveAIProvider DB lookup failed for ${tenantId}:`, err.message);
    }

    // Step 3 — Platform fallback
    const fallbackKey = process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;
    if (fallbackKey) return { key: fallbackKey, provider: 'google', model: 'gemini-2.0-flash' };
    return undefined;
}

// ─── OpenAI tool mapper ───────────────────────────────────────────────────────
// Maps geminiTools (Google FunctionDeclaration format) → OpenAI ChatCompletionTool format.

function schemaToOpenAI(schema: any): any {
    if (!schema) return { type: 'object', properties: {} };
    const out: any = { type: (schema.type ?? 'OBJECT').toLowerCase() };
    if (schema.description) out.description = schema.description;
    if (schema.enum) out.enum = schema.enum;
    if (schema.properties) {
        out.properties = Object.fromEntries(
            Object.entries(schema.properties).map(([k, v]) => [k, schemaToOpenAI(v)])
        );
    }
    if (schema.items) out.items = schemaToOpenAI(schema.items);
    if (schema.required) out.required = schema.required;
    return out;
}

const openAITools: OpenAI.ChatCompletionTool[] = Object.values(toolsMap).map((tool: any) => ({
    type: 'function' as const,
    function: {
        name: tool.name,
        description: tool.description,
        parameters: schemaToOpenAI(tool.parameters),
    },
}));

// ─── OpenAI tool loop ─────────────────────────────────────────────────────────
async function runToolLoopOpenAI(
    openai: OpenAI,
    model: string,
    systemPrompt: string,
    userText: string,
    history: OpenAI.ChatCompletionMessageParam[],
    toolContext: any,
    logPrefix: string,
): Promise<{ reply: string; updatedHistory: OpenAI.ChatCompletionMessageParam[] }> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userText },
    ];

    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
        iterations++;
        const response = await openai.chat.completions.create({
            model,
            messages,
            tools: openAITools,
            tool_choice: 'auto',
        });

        const msg = response.choices[0].message;
        messages.push(msg);

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            // No more tool calls — final text response
            const updatedHistory = messages.slice(1); // drop system prompt
            return { reply: msg.content ?? '', updatedHistory };
        }

        // Execute each tool call
        for (const toolCall of msg.tool_calls) {
            const fn = (toolCall as any).function as { name: string; arguments: string };
            const toolName = fn.name;
            const tool = (toolsMap as any)[toolName];
            let result: string;
            if (!tool) {
                result = JSON.stringify({ error: `Unknown tool: ${toolName}` });
            } else {
                try {
                    const params = JSON.parse(fn.arguments);
                    const toolResult = await tool.execute(params, toolContext);
                    result = JSON.stringify(toolResult);
                    if (toolResult?.success === false || toolResult?.ok === false) {
                        const errMsg = toolResult?.error ?? toolResult?.message ?? 'unknown error';
                        await draftSkillFromFailure({ tenantId: tenantId(toolContext), toolName, args: params, error: String(errMsg) }).catch(() => {});
                    }
                } catch (err: any) {
                    result = JSON.stringify({ error: err.message });
                    await draftSkillFromFailure({ tenantId: tenantId(toolContext), toolName, args: {}, error: err.message }).catch(() => {});
                }
            }
            console.log(`[${logPrefix}] Tool ${toolName} result:`, result.slice(0, 120));
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }
    }

    console.warn(`[${logPrefix}] Max tool iterations reached for OpenAI loop.`);
    return { reply: 'I hit my reasoning limit. Please try again.', updatedHistory: messages.slice(1) };
}

function tenantId(toolContext: any): string {
    return toolContext?.sessionKey ?? toolContext?.agentId ?? 'unknown';
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

// ─── Hive benchmark loader ───────────────────────────────────────────────────
/**
 * Loads top hive signals and approved patterns for this tenant's flavor/region.
 * Injected into buildSystemPrompt() so every conversation benefits from
 * cross-tenant learning. Uses the Universal Prior fallback chain.
 *
 * HIVE_CHARTER.md governs data flow and privacy rules.
 * SKILLS_PROTOCOL.md documents the self-improvement lifecycle.
 */
async function loadHiveBenchmarks(flavor: string, region: string): Promise<string[]> {
    const lines: string[] = [];

    // Query the key signal types that inform agent behavior
    const signalTypes = [
        { key: 'ideal_customer_profile', label: 'ICP Benchmark' },
        { key: 'conversion_rate',        label: 'Conversion Intelligence' },
        { key: 'objection_resolution',   label: 'Objection Handling' },
        { key: 'scout_hit_rate',         label: 'Scouting Effectiveness' },
    ];

    for (const { key, label } of signalTypes) {
        try {
            const signal = await getHiveSignalWithFallback(key, flavor, region);
            if (!signal) continue;

            const attribution = hiveAttributionLabel(signal);
            const payloadSummary = Object.entries(signal.payload)
                .filter(([k]) => k !== 'userLabel') // strip internal metadata
                .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                .join('\n');

            lines.push(`[${label}] ${attribution} (n=${signal.sampleSize})`);
            if (payloadSummary) lines.push(payloadSummary);
        } catch {
            // Non-fatal — skip this signal type
        }
    }

    // Also inject top 3 approved hive patterns for this flavor/region
    try {
        const patterns = await queryHivePatterns({ flavor, region, limit: 3 });
        if (patterns.length > 0) {
            lines.push('');
            lines.push('Top community patterns:');
            for (const p of patterns) {
                lines.push(`- [${p.category}] ${p.observation} (confidence: ${Math.round(p.confidence * 100)}%, n=${p.dataPoints})`);
            }
        }
    } catch {
        // Non-fatal — patterns table may not exist yet
    }

    return lines;
}

// ─── FITFO loader ────────────────────────────────────────────────────────────
function loadFitfao(): string {
    try {
        // __dirname = api/dist/services (at runtime) or api/src/services (ts-node)
        // Walk up 3 levels to reach the repo root where FITFO.md lives
        const fitfaoPath = path.resolve(__dirname, '..', '..', '..', 'FITFO.md');
        return fs.readFileSync(fitfaoPath, 'utf-8');
    } catch {
        return ''; // Non-fatal — operate without it if file is missing
    }
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

    // Load dynamic approved skills for this tenant
    const approvedSkills = await loadApprovedSkills(tenant.id, tenant.flavor).catch(() => []);

    // Load hive benchmarks — cross-tenant intelligence for this flavor/region
    const hiveBenchmarks = await loadHiveBenchmarks(
        tenant.flavor ?? 'universal',
        tenant.region ?? 'universal',
    ).catch(() => []);

    // Load FITFO operating protocol
    const fitfao = loadFitfao();

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
        `ONBOARDING:`,
        `- If onboarding is NOT complete (no identity, no ICP data above), your VERY FIRST priority is to get it done.`,
        `- On the operator's first message, proactively invite them: briefly introduce yourself, tell them you need 5 minutes to calibrate to their business, and ask if now is a good time. Then call tiger_onboard(action="start").`,
        `- If the user is actively answering your onboarding questions, call tiger_onboard(action="respond", response=<their message>).`,
        `- If onboarding IS complete, never mention it again. Treat the identity and ICP data as facts you simply know.`,
        `- Allow organic conversation at any time — the operator can ask questions, vent, or request anything. Don't hold them hostage to onboarding flow. But always return to completing it if it's unfinished.`,
        ``,
        `TOOL JUDGMENT — READ THIS CAREFULLY:`,
        `You have 19 specialized tools. You are intelligent enough to know when to use them without being told.`,
        `Use tools as instruments of your judgment — not because a user's words match a keyword.`,
        `When a tool would serve the operator better than a direct answer, use it silently and report results.`,
        `When you can reason, advise, coach, or respond directly with genuine insight, do that instead.`,
        `Never explain which tools you have. Never ask the operator which tool to invoke. Think, decide, act.`,
        ``,
        `JUDGMENT EXAMPLES (internalize these, don't recite them):`,
        `- Operator vents about slow results → acknowledge first, then offer to scan for new leads. Don't jump to a tool call before they feel heard.`,
        `- Operator asks a strategy question ("how should I handle a prospect who said maybe?") → answer it directly from your expertise. You are a consultant, not a dispatcher.`,
        `- Operator says "find me leads" or "scan" or "hunt" → use tiger_scout immediately, no explanation.`,
        `- Operator asks about their pipeline or who to contact today → use tiger_briefing, then interpret.`,
        `- Operator says "reach out to [name]" → use tiger_contact. No preamble.`,
        `- Operator reports a win or sign-up → use tiger_convert to log it, celebrate briefly, move forward.`,
        `- Operator asks something you can answer from knowledge → answer it. Don't force a tool call.`,
        ``,
        `WHEN PIPELINE IS EMPTY OR SLOW:`,
        `Never tell the operator to talk to friends, family, or their "warm market". That is permanently banned.`,
        `Instead: acknowledge the gap, tell them you are recalibrating search parameters and scanning new channels, then use tiger_scout to act on it immediately.`,
        ``,
        `CRITICAL TELEMETRY (silent, always):`,
        `- After every outbound prospect message or significant tool result, call tiger_keys(action="record_message").`,
        `- If an API errors out, call tiger_keys(action="report_error", error=status).`,
        // Dynamic approved skills (injected at runtime, curated by platform/admin)
        ...(approvedSkills.length > 0
            ? [``, `━━━━ DYNAMIC SKILLS (PLATFORM-APPROVED) ━━━━`, ...approvedSkills]
            : []
        ),
        // Hive benchmarks — cross-tenant intelligence (anonymized, PII-stripped)
        ...(hiveBenchmarks.length > 0
            ? [
                ``,
                `━━━━ HIVE INTELLIGENCE (CROSS-PLATFORM BENCHMARKS) ━━━━`,
                `The following benchmarks are derived from anonymized, aggregated data across all Tiger Claw agents in your vertical and region. Use them to calibrate your strategies — but always prioritize your operator's specific context over general benchmarks.`,
                ...hiveBenchmarks,
            ]
            : []
        ),
        // FITFO operating protocol (agent self-improvement and persistence rules)
        ...(fitfao ? [``, `━━━━ OPERATING PROTOCOL ━━━━`, fitfao] : []),
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
                    // FITFO Failure Rule: if tool returns ok:false, draft a skill immediately
                    if (toolResult?.ok === false || toolResult?.success === false) {
                        const errMsg = toolResult?.error ?? toolResult?.message ?? 'unknown error';
                        draftSkillFromFailure({
                            tenantId: toolContext.agentId,
                            toolName: fc.name,
                            args: fc.args ?? {},
                            error: String(errMsg),
                        }).catch(e => console.error(`[${logPrefix}] draftSkillFromFailure failed:`, e.message));
                    }
                } catch (toolErr: any) {
                    console.error(`[${logPrefix}] Tool ${fc.name} threw:`, toolErr.message);
                    toolResult = { error: toolErr.message };
                    // FITFO Failure Rule: exception = immediate skill draft
                    draftSkillFromFailure({
                        tenantId: toolContext.agentId,
                        toolName: fc.name,
                        args: fc.args ?? {},
                        error: toolErr.message,
                    }).catch(e => console.error(`[${logPrefix}] draftSkillFromFailure failed:`, e.message));
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

// ─── Exported for testing ─────────────────────────────────────────────────────
export function buildFirstMessageText(
    operatorText: string,
    onboardingComplete: boolean,
    isFirstMessage: boolean,
): string {
    if (!onboardingComplete && isFirstMessage) {
        return `[SYSTEM — NOT VISIBLE TO PROSPECT] This is the operator's first message. Onboarding is not complete. Introduce yourself warmly in one sentence, tell the operator you need 5 minutes to calibrate to their business, then immediately call tiger_onboard(action="start"). The operator's actual message was: "${operatorText}"`;
    }
    return operatorText;
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
        const aiProvider = await resolveAIProvider(tenantId);

        if (!aiProvider) {
            console.warn(`[AI] No key resolved for tenant ${tenantId} — sending paused message.`);
            const wizardUrl = process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io';
            await bot.sendMessage(
                chatId,
                `⚠️ Your bot is paused. Add your API key at ${wizardUrl} to reactivate.`,
            );
            return;
        }

        console.log(`[AI] Key resolved for tenant ${tenantId} (provider=${aiProvider.provider}, model=${aiProvider.model}).`);

        await bot.sendChatAction(chatId, 'typing');

        const onboardState = await getBotState<any>(tenantId, 'onboard_state.json').catch(() => null);
        const onboardingComplete = onboardState?.phase === 'complete';
        const isFirstMessage = (await getChatHistory(tenantId, chatId)).length === 0;
        const effectiveText = buildFirstMessageText(text, onboardingComplete, isFirstMessage);

        // ── Check feedback loop: is this message a feedback response? ──────────
        await maybeLogFeedback(tenantId, chatId, text, bot, tenant, aiProvider, toolContext);

        if (aiProvider.provider === 'openai') {
            const openai = new OpenAI({ apiKey: aiProvider.key });
            const history = await getOpenAIChatHistory(tenantId, chatId);
            const systemPrompt = await buildSystemPrompt(tenant);
            const { reply, updatedHistory } = await runToolLoopOpenAI(
                openai, aiProvider.model, systemPrompt, effectiveText, history, toolContext, 'AI',
            );
            await saveOpenAIChatHistory(tenantId, chatId, updatedHistory);
            if (reply.trim()) await bot.sendMessage(chatId, reply);
            else console.warn(`[AI] [ALERT] OpenAI returned empty reply for tenant ${tenantId}`);
            return;
        }

        // ── Gemini path ────────────────────────────────────────────────────────
        const history = await getChatHistory(tenantId, chatId);
        console.log(`[AI] History loaded: ${history.length} entries`);

        const genAI = new GoogleGenerativeAI(aiProvider.key);
        const model = genAI.getGenerativeModel({
            model: aiProvider.model,
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        });

        const chat = model.startChat({ history });
        console.log(`[AI] Sending message to Gemini: "${effectiveText.slice(0, 80)}"`);
        const initial = await chat.sendMessage(effectiveText);
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
        const aiProvider = await resolveAIProvider(tenantId);

        if (!aiProvider) {
            console.warn(`[AI Routine] [ALERT] No API key for tenant ${tenantId}. Aborting ${routineType}.`);
            return;
        }

        // System routines always start with a clean history. Persisting routine
        // chat history causes the next run to start with a 'function' role message
        // (from the previous run's tool responses), which Gemini rejects.
        const genAI = new GoogleGenerativeAI(aiProvider.provider === 'google' ? aiProvider.key : '');
        const model = aiProvider.provider === 'google' ? genAI.getGenerativeModel({
            model: aiProvider.model,
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        }) : null;

        const wizardUrl = process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io';
        const systemPrompts: Record<string, string> = {
            daily_scout:   'SYSTEM: Run your Daily Scout routine. Find new leads to contact.',
            nurture_check: 'SYSTEM: Run your Nurture Check. Review follow-ups and reach out where due.',
            trial_reminder_24h: `SYSTEM: Write a 1-sentence, highly conversational Telegram message to your operator reminding them they have 48 hours left on their free trial. Tell them to securely plug in their API key at ${wizardUrl} so you don't have to stop working for them. Use your exact flavor and personality. NEVER use placeholders. Do NOT execute any tools.`,
            trial_reminder_48h: `SYSTEM: Write a 1-sentence, highly conversational Telegram message to your operator reminding them they have 24 hours left on their free trial. Tell them to securely plug in their API key at ${wizardUrl} so you don't have to stop working for them. Use your exact flavor and personality. NEVER use placeholders. Do NOT execute any tools.`,
            trial_reminder_72h: `SYSTEM: Write a 1-sentence, highly conversational Telegram message to your operator telling them their 72-hour free trial is officially complete, and you have paused your operations so their flywheel has stopped. Tell them to unlock their bot to resume scouting at ${wizardUrl}. Use your exact flavor and personality. NEVER use placeholders. Do NOT execute any tools.`,
            weekly_checkin: `SYSTEM: You are checking in with your operator as a coach and strategic partner. Write a warm, brief Telegram message asking them to share one win and one challenge from this week. Keep it conversational, not formal. Sign off with your name. Do NOT execute any tools.`,
            feedback_reminder: `SYSTEM: Your operator hasn't responded to your weekly check-in yet. Send a short, friendly nudge — one sentence. Remind them you're waiting to hear how things are going. Use your personality. Do NOT execute any tools.`,
            feedback_pause: `SYSTEM: Your operator has not responded to your weekly check-in or reminder. Write a very brief message telling them you're pausing your operations until they check in with you. Keep it warm, not punitive. Tell them to just reply to this message to resume. Do NOT execute any tools.`,
            value_gap_checkin: `SYSTEM: Your Tiger hasn't surfaced a lead in 3 days. Send this exact diagnostic message to your operator — do not paraphrase it, do not add fluff, keep it plain and honest:\n\n"Hey — your Tiger hasn't surfaced a lead in 3 days. Here are the most common reasons:\n\n1. Bot not shared with your team or leads\n2. API key hitting rate limits\n3. Wrong niche flavor set for your market\n\nCheck your setup at ${process.env['FRONTEND_URL'] ?? 'https://wizard.tigerclaw.io'} — it takes two minutes to diagnose."\n\nDo NOT execute any tools. Send only this message, nothing else.`,
        };
        const prompt = systemPrompts[routineType] ?? `SYSTEM: Execute routine: ${routineType}`;

        // Helper: get text from either provider
        const getRoutineText = async (): Promise<string> => {
            if (aiProvider.provider === 'openai') {
                const openai = new OpenAI({ apiKey: aiProvider.key });
                const res = await openai.chat.completions.create({
                    model: aiProvider.model,
                    messages: [
                        { role: 'system', content: await buildSystemPrompt(tenant) },
                        { role: 'user', content: prompt },
                    ],
                });
                return res.choices[0].message.content ?? '';
            }
            if (!model) return '';
            const chat = model.startChat({ history: [] });
            const initial = await chat.sendMessage(prompt);
            // For tool-loop routines, run the loop
            if (routineType === 'daily_scout' || routineType === 'nurture_check') {
                await runToolLoop(chat, initial.response, toolContext, `AI Routine:${routineType}`);
                return '';
            }
            return initial.response.text?.() ?? '';
        };

        // ── Value-gap diagnostic (CLAUDE.md mandate) ──────────────────────────
        if (routineType === 'value_gap_checkin') {
            const message = await getRoutineText();
            if (message) {
                const botToken = await getTenantBotToken(tenantId);
                if (botToken) {
                    const chatIds = await getTenantChatIds(tenantId);
                    const bot = new TelegramBot(botToken);
                    for (const cid of chatIds) {
                        await bot.sendMessage(cid, message).catch(err =>
                            console.error(`[AI Routine] Failed to send value_gap_checkin to ${cid}:`, err.message)
                        );
                    }
                }
            }
        // ── Feedback loop routines ─────────────────────────────────────────────
        } else if (routineType === 'weekly_checkin' || routineType === 'feedback_reminder' || routineType === 'feedback_pause') {
            const message = await getRoutineText();
            if (message) {
                const botToken = await getTenantBotToken(tenantId);
                if (botToken) {
                    const chatIds = await getTenantChatIds(tenantId);
                    const bot = new TelegramBot(botToken);
                    for (const cid of chatIds) {
                        await bot.sendMessage(cid, message).catch(err =>
                            console.error(`[AI Routine] Failed to send ${routineType} to ${cid}:`, err.message)
                        );
                    }
                }
                if (routineType === 'feedback_pause') {
                    // Pause the tenant until they respond
                    const pool = getPool();
                    await pool.query(
                        `UPDATE tenants SET feedback_paused = true, feedback_pause_sent_at = now() WHERE id = $1`,
                        [tenantId],
                    );
                } else if (routineType === 'feedback_reminder') {
                    const pool = getPool();
                    await pool.query(
                        `UPDATE tenants SET feedback_reminder_sent_at = now() WHERE id = $1`,
                        [tenantId],
                    );
                }
            }
        // ── Trial reminders ────────────────────────────────────────────────────
        } else if (routineType.startsWith('trial_reminder_')) {
            const hoursRemainingMap: Record<string, number> = {
                trial_reminder_24h: 48,
                trial_reminder_48h: 24,
                trial_reminder_72h: 0,
            };
            const hoursRemaining = hoursRemainingMap[routineType] ?? 0;
            let finalResponse = await getRoutineText();
            if (finalResponse) {
                if (routineType === 'trial_reminder_72h') {
                    const stanStoreUrl = process.env['STAN_STORE_URL'];
                    if (stanStoreUrl) finalResponse += `\n\nTo unlock your bot and resume operations: ${stanStoreUrl}`;
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
                if (tenant.email) {
                    await sendTrialReminderEmail(tenant.email, hoursRemaining).catch(err =>
                        console.error(`[AI Routine] Failed to send trial reminder email to ${tenant.email}:`, err.message)
                    );
                }
                if (routineType === 'trial_reminder_72h') {
                    const botState = JSON.parse(await getBotState(tenantId, 'key_state.json') || '{}');
                    botState.tenantPaused = true;
                    await setBotState(tenantId, 'key_state.json', botState);
                }
            }
        } else {
            // Standard tool loop (daily_scout, nurture_check)
            await getRoutineText();
        }

        console.log(`[AI Routine] ${routineType} complete for tenant ${tenantId}.`);
    } catch (err: any) {
        console.error(`[AI Routine] [ALERT] ${routineType} failed for tenant ${tenantId}:`, err.message);
    }
}

// ─── OpenAI chat history (stored separately from Gemini history) ─────────────
// Gemini history uses Content[] format; OpenAI uses ChatCompletionMessageParam[].
// We keep them in separate Redis keys to avoid format conflicts.

async function getOpenAIChatHistory(tenantId: string, chatId: number): Promise<OpenAI.ChatCompletionMessageParam[]> {
    try {
        const raw = await redis.get(`oai_history:${tenantId}:${chatId}`);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch { return []; }
}

async function saveOpenAIChatHistory(tenantId: string, chatId: number, history: OpenAI.ChatCompletionMessageParam[]): Promise<void> {
    const trimmed = history.slice(-40); // keep last 40 messages (~20 turns)
    await redis.set(`oai_history:${tenantId}:${chatId}`, JSON.stringify(trimmed), 'EX', 60 * 60 * 24 * 30);
}

// ─── Feedback loop detection ──────────────────────────────────────────────────
// Called on every inbound Telegram message. If the tenant has feedback_loop_enabled
// and hasn't checked in this week, this message IS their check-in response.
// We log it, generate a coaching reply, and clear the feedback_paused flag.

async function maybeLogFeedback(
    tenantId: string,
    chatId: number,
    text: string,
    bot: TelegramBot,
    tenant: any,
    aiProvider: AIProvider,
    toolContext: any,
): Promise<void> {
    const pool = getPool();
    const res = await pool.query(
        `SELECT feedback_loop_enabled, feedback_paused, last_feedback_at
         FROM tenants WHERE id = $1`,
        [tenantId],
    );
    if (!res.rows.length) return;
    const { feedback_loop_enabled, feedback_paused, last_feedback_at } = res.rows[0];
    if (!feedback_loop_enabled) return;

    // Is this within the weekly feedback window? (Monday 8am → Sunday midnight)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const alreadyCheckedInThisWeek = last_feedback_at && new Date(last_feedback_at) > weekAgo;
    if (alreadyCheckedInThisWeek && !feedback_paused) return;

    // This message is a feedback response — log it and generate coaching reply
    const coachingPrompt = `SYSTEM: Your operator just responded to your weekly check-in with: "${text}"

Respond as their strategic coach and partner. In 2-4 sentences:
1. Acknowledge their specific win or challenge
2. Give ONE concrete, actionable suggestion based on what they shared
3. End with energy and encouragement

Use your exact personality. Be specific to what they said, not generic. Do NOT execute any tools.`;

    let coachingReply = '';
    try {
        if (aiProvider.provider === 'openai') {
            const openai = new OpenAI({ apiKey: aiProvider.key });
            const res2 = await openai.chat.completions.create({
                model: aiProvider.model,
                messages: [
                    { role: 'system', content: await buildSystemPrompt(tenant) },
                    { role: 'user', content: coachingPrompt },
                ],
            });
            coachingReply = res2.choices[0].message.content ?? '';
        } else {
            const genAI = new GoogleGenerativeAI(aiProvider.key);
            const model = genAI.getGenerativeModel({
                model: aiProvider.model,
                systemInstruction: await buildSystemPrompt(tenant),
            });
            const result = await model.generateContent(coachingPrompt);
            coachingReply = result.response.text() ?? '';
        }
    } catch (err: any) {
        console.error(`[Feedback] Coaching reply generation failed for ${tenantId}:`, err.message);
    }

    // Log feedback to DB
    await pool.query(
        `INSERT INTO tenant_feedback (tenant_id, content, coaching_reply) VALUES ($1, $2, $3)`,
        [tenantId, text, coachingReply || null],
    );

    // Clear paused state, update last_feedback_at
    await pool.query(
        `UPDATE tenants SET last_feedback_at = now(), feedback_paused = false,
         feedback_pause_sent_at = null, feedback_reminder_sent_at = null WHERE id = $1`,
        [tenantId],
    );

    // Send coaching reply if we got one (separate from the normal AI response)
    if (coachingReply.trim()) {
        await bot.sendMessage(chatId, `💬 ${coachingReply}`).catch(err =>
            console.error(`[Feedback] Failed to send coaching reply to ${chatId}:`, err.message)
        );
    }

    console.log(`[Feedback] Logged feedback for tenant ${tenantId}. Paused cleared: ${feedback_paused}`);
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
    const aiProvider = await resolveAIProvider(tenantId);

    if (!aiProvider) {
        await sendLineMessage('⚠️ Your bot is paused. Please contact support or add your API key to reactivate.');
        return;
    }

    // Use LINE userId as chatId for per-user history (stored as string in Redis key)
    const chatId = userId as unknown as number;

    try {
        const history = await getChatHistory(tenantId, chatId);
        const genAI = new GoogleGenerativeAI(aiProvider.provider === 'google' ? aiProvider.key : '');
        const model = aiProvider.provider === 'google' ? genAI.getGenerativeModel({
            model: aiProvider.model,
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        }) : null;

        let replyText = '';
        if (aiProvider.provider === 'openai') {
            const openai = new OpenAI({ apiKey: aiProvider.key });
            const oaiHistory = await getOpenAIChatHistory(tenantId, chatId);
            const { reply, updatedHistory: newHist } = await runToolLoopOpenAI(
                openai, aiProvider.model, await buildSystemPrompt(tenant), text, oaiHistory, toolContext, 'AI LINE',
            );
            await saveOpenAIChatHistory(tenantId, chatId, newHist);
            replyText = reply;
        } else {
            const chat = model!.startChat({ history });
            const initial = await chat.sendMessage(text);
            const finalResponse = await runToolLoop(chat, initial.response, toolContext, 'AI');
            const updatedHistory = await chat.getHistory();
            await saveChatHistory(tenantId, chatId, updatedHistory);
            replyText = finalResponse.text?.() ?? '';
        }

        if (replyText.trim().length > 0) {
            await sendLineMessage(replyText);
        }
    } catch (err: any) {
        console.error(`[AI] [ALERT] processLINEMessage failed for tenant ${tenantId}:`, err.message);
        await sendLineMessage('❌ Something went wrong. The operator has been notified. Please try again in a moment.');
    }
}
