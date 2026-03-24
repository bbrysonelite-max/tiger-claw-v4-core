import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { getTenant, getPool, getBotState, setBotState, getTenantBotToken } from './db.js';
import { getTenantState } from './tenant_data.js';
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

// Sawtooth threshold: trigger compression after this many tool calls in a single session
// (in addition to the length-based trigger in saveChatHistory)
const FOCUS_COMPRESSION_THRESHOLD = 12;

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

// ─── Sawtooth compression ────────────────────────────────────────────────────
// When history hits the trim threshold, summarize the entries about to be
// dropped and merge into chat_memory (30-day TTL). On next load, the summary
// is injected as a synthetic user/model pair so the agent retains long-term
// context without blowing the context window.
//
// Uses PLATFORM_ONBOARDING_KEY — this is an internal platform call, not
// tenant-billable. Fails silently: the hard trim still happens on any error.
async function compressChatHistory(
    tenantId: string,
    chatId: number,
    droppedEntries: Content[],
): Promise<void> {
    try {
        const platformKey = process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;
        if (!platformKey) return;

        // Serialize dropped entries as plain text for the compression prompt
        const plainText = droppedEntries
            .filter(e => e.role === 'user' || e.role === 'model')
            .map(e => {
                const text = (e.parts ?? []).map((p: any) => p.text ?? '').join(' ').trim();
                return text ? `${e.role}: ${text}` : null;
            })
            .filter(Boolean)
            .join('\n');

        if (!plainText) return;

        const genAI = new GoogleGenerativeAI(platformKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent(
            `Summarize the key facts from this conversation that the agent needs to remember about the operator's business. ` +
            `Be concise. Max 150 words. Focus on stated preferences, ICP updates, hot leads, and decisions made.\n\n${plainText}`,
        );
        const newSummary = result.response.text?.() ?? '';
        if (!newSummary.trim()) return;

        // Merge with any existing memory blob
        const memKey = `chat_memory:${tenantId}:${chatId}`;
        const existing = await redis.get(memKey);
        let combined = newSummary;
        if (existing) {
            try {
                const blob = JSON.parse(existing);
                if (blob.summary) combined = `${blob.summary}\n---\n${newSummary}`;
            } catch { /* malformed — overwrite */ }
        }

        await redis.set(
            memKey,
            JSON.stringify({ summary: combined, compressedAt: new Date().toISOString(), turnsCompressed: droppedEntries.length }),
            'EX',
            86400 * 30,
        );
        console.log(`[AI] Compressed ${droppedEntries.length} entries into chat_memory for tenant ${tenantId}`);
    } catch (err: any) {
        console.warn(`[AI] compressChatHistory failed for tenant ${tenantId} — falling back to hard trim:`, err.message);
    }
}

// ─── Focus primitives (Sawtooth session bookending) ──────────────────────────
// focus_state:{tenantId}:{chatId} — Redis key, 24h TTL
// Tracks tool call count per session. When completeFocus() sees >= threshold,
// it triggers compressChatHistory() proactively (in addition to the length-based
// trigger in saveChatHistory, which remains as the safety net).

export async function startFocus(tenantId: string, chatId: number | string): Promise<string> {
    const focusId = `${tenantId}:${chatId}:${Date.now()}`;
    try {
        await redis.set(
            `focus_state:${tenantId}:${chatId}`,
            JSON.stringify({ focusId, startedAt: new Date().toISOString(), toolCallsSinceStart: 0, status: 'active' }),
            'EX',
            86400,
        );
    } catch (err: any) {
        console.warn(`[AI] startFocus failed for tenant ${tenantId}:`, err.message);
    }
    return focusId;
}

export async function incrementFocusToolCalls(tenantId: string, chatId: number | string): Promise<void> {
    try {
        const raw = await redis.get(`focus_state:${tenantId}:${chatId}`);
        if (!raw) return;
        const state = JSON.parse(raw);
        state.toolCallsSinceStart = (state.toolCallsSinceStart ?? 0) + 1;
        await redis.set(`focus_state:${tenantId}:${chatId}`, JSON.stringify(state), 'EX', 86400);
    } catch { /* non-critical */ }
}

export async function completeFocus(tenantId: string, chatId: number | string, history: Content[]): Promise<void> {
    try {
        const raw = await redis.get(`focus_state:${tenantId}:${chatId}`);
        if (!raw) return;
        const state = JSON.parse(raw);

        if ((state.toolCallsSinceStart ?? 0) >= FOCUS_COMPRESSION_THRESHOLD) {
            // Tool-call-count triggered compression (Sawtooth proactive cycle)
            const droppedEntries = history.slice(0, Math.max(0, history.length - MAX_HISTORY_TURNS * 2));
            if (droppedEntries.length > 0) {
                compressChatHistory(tenantId, chatId as number, droppedEntries).catch(() => {});
            }
        }

        state.status = 'complete';
        await redis.set(`focus_state:${tenantId}:${chatId}`, JSON.stringify(state), 'EX', 86400);
    } catch { /* non-critical */ }
}

export async function getChatHistory(tenantId: string, chatId: number): Promise<Content[]> {
    try {
        const [raw, memRaw] = await Promise.all([
            redis.get(`chat_history:${tenantId}:${chatId}`),
            redis.get(`chat_memory:${tenantId}:${chatId}`),
        ]);

        if (!raw) return [];
        const history: Content[] = JSON.parse(raw);
        // Gemini requires history to start with role 'user'. If a trim previously cut mid-exchange,
        // a 'function' or 'model' role entry could be at position 0. Strip leading non-user entries.
        const firstUserIdx = history.findIndex(h => h.role === 'user');
        if (firstUserIdx < 0) return []; // no user entry at all — discard
        const cleaned = firstUserIdx > 0 ? history.slice(firstUserIdx) : history;
        if (firstUserIdx > 0) {
            console.warn(`[AI] History for tenant ${tenantId} started with role '${history[0].role}' — trimming ${firstUserIdx} leading entries.`);
        }

        // Prepend conversation memory as a synthetic user/model pair so the agent
        // has long-term context without it counting against the active turn window.
        if (memRaw) {
            try {
                const blob = JSON.parse(memRaw);
                if (blob.summary) {
                    const memoryPair: Content[] = [
                        { role: 'user', parts: [{ text: '[CONVERSATION MEMORY — prior session context]' }] },
                        { role: 'model', parts: [{ text: blob.summary }] },
                    ];
                    return [...memoryPair, ...cleaned];
                }
            } catch { /* malformed memory blob — ignore */ }
        }

        return cleaned;
    } catch (err: any) {
        // BUG 3 FIX: loud failure — do not silently ignore
        console.error(`[AI] [ALERT] Failed to load chat history for tenant ${tenantId}:`, err.message);
        return []; // start fresh rather than crash
    }
}

export async function saveChatHistory(tenantId: string, chatId: number, history: Content[]): Promise<void> {
    // Sawtooth: before trimming, compress the entries that are about to be dropped
    // into a chat_memory summary. Fire-and-forget — trim still happens immediately.
    if (history.length > MAX_HISTORY_TURNS * 2) {
        const droppedEntries = history.slice(0, history.length - MAX_HISTORY_TURNS * 2);
        compressChatHistory(tenantId, chatId, droppedEntries).catch(() => { /* already logged inside */ });
    }

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

// ─── Memory context ───────────────────────────────────────────────────────────
/**
 * Loads tenant-specific intelligence for system prompt injection.
 * Runs three parallel DB reads. Fails silently — static prompt is the fallback.
 */
async function buildMemoryContext(tenantId: string, flavor: string, region: string): Promise<{
    icpSummary: string | null;
    hivePatterns: string | null;
    leadStats: string | null;
}> {
    try {
        const pool = getPool();
        const [onboardState, hiveResult, leadResult, factAnchors] = await Promise.all([
            getBotState<any>(tenantId, 'onboard_state.json'),
            pool.query(
                `SELECT signal_type, payload, sample_size FROM hive_signals
                 WHERE vertical = $1 AND region = ANY($2::text[])
                 ORDER BY sample_size DESC LIMIT 3`,
                [flavor, [region || 'universal', 'universal']],
            ),
            pool.query(
                `SELECT
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE qualified = true AND opted_out = false) AS qualified
                 FROM tenant_leads WHERE tenant_id = $1`,
                [tenantId],
            ),
            getTenantState<any>(tenantId, 'fact_anchors'),
        ]);

        // ICP summary — only if onboarding complete
        let icpSummary: string | null = null;
        if (onboardState && onboardState.phase === 'complete') {
            const id = onboardState.identity ?? {};
            const icp = onboardState.icpBuilder?.confirmed
                ? onboardState.icpBuilder
                : onboardState.icpCustomer?.confirmed
                    ? onboardState.icpCustomer
                    : onboardState.icpSingle;
            const parts: string[] = [];
            if (id.name) parts.push(`Operator: ${id.name}.`);
            if (id.productOrOpportunity) parts.push(`Product: ${id.productOrOpportunity}.`);
            if (id.biggestWin) parts.push(`Top result: ${id.biggestWin}.`);
            if (icp?.idealPerson) parts.push(`Ideal prospect: ${icp.idealPerson}.`);
            if (icp?.problemFaced) parts.push(`Core problem they face: ${icp.problemFaced}.`);
            if (id.differentiator) parts.push(`Competitive edge: ${id.differentiator}.`);
            if (parts.length > 0) icpSummary = parts.join(' ');
        }

        // Augment ICP summary with live fact anchors from conversations
        if (factAnchors) {
            const anchorParts: string[] = [];
            const latest = (arr: any[]) => arr?.slice(-1)[0]?.value;
            if (latest(factAnchors.icpUpdates)) anchorParts.push(`Recent ICP signal: ${latest(factAnchors.icpUpdates)}.`);
            if (latest(factAnchors.objectionsRaised)) anchorParts.push(`Last objection raised: ${latest(factAnchors.objectionsRaised)}.`);
            if (latest(factAnchors.preferencesStated)) anchorParts.push(`Stated preference: ${latest(factAnchors.preferencesStated)}.`);
            if (anchorParts.length > 0) {
                icpSummary = [icpSummary, ...anchorParts].filter(Boolean).join(' ');
            }
        }

        // Hive patterns — community intelligence
        let hivePatterns: string | null = null;
        if (hiveResult.rows.length > 0) {
            const bullets = hiveResult.rows.map((row: any) => {
                const obs = row.payload?.observation ?? row.payload?.insight ?? String(row.payload).slice(0, 120);
                return `• ${row.signal_type} (n=${row.sample_size}): ${obs}`;
            });
            hivePatterns = bullets.join('\n');
        }

        // Lead pipeline stats
        let leadStats: string | null = null;
        const lr = leadResult.rows[0];
        if (lr && parseInt(lr.total, 10) > 0) {
            leadStats = `${lr.total} leads in pipeline, ${lr.qualified} qualified.`;
        }

        return { icpSummary, hivePatterns, leadStats };
    } catch (err: any) {
        console.warn(`[AI] buildMemoryContext failed for tenant ${tenantId} — using static prompt:`, err.message);
        return { icpSummary: null, hivePatterns: null, leadStats: null };
    }
}

// ─── System prompt ────────────────────────────────────────────────────────────
/**
 * Builds the system prompt for a tenant.
 * Async: injects live ICP summary, hive network patterns, and pipeline stats.
 * Fails open — DB errors return the static prompt without crashing.
 */
export async function buildSystemPrompt(tenant: any): Promise<string> {
    const flavor = loadFlavorConfig(tenant.flavor);
    const memory = await buildMemoryContext(tenant.id, tenant.flavor ?? '', tenant.region ?? 'universal');

    const lines: string[] = [
        `You are Tiger Claw, an elite AI sales and recruiting agent operating for ${tenant.name}.`,
        `Industry flavor: ${flavor.name} (${flavor.professionLabel}).`,
        `Respond in: ${tenant.language ?? 'English'}.`,
        `Lead scoring threshold: 80 (LOCKED — never contact a prospect scoring below 80).`,
        `Key prospect keywords: ${flavor.defaultKeywords.slice(0, 8).join(', ')}.`,
        ``,
        `VOICE — GLOBAL RULE (applies to every message, every mode):`,
        `Sound like a sharp, confident colleague. Direct. Never hype. Never a pep rally.`,
        `BANNED PHRASES — never generate any of these under any circumstances:`,
        `"crush it", "mouth closed business closed", "mouth is closed your business is closed", "if your mouth is closed",`,
        `"talk to 3 people", "talk to three people", "warm market", "warm circle of influence",`,
        `"your why", "what's the play", "what's the move", "let's get after it", "ready to get after it",`,
        `"manufacture some success", "let's manufacture", "hustle", "grind", "beast mode",`,
        `or any variation of classic network marketing hype scripts. These are permanently banned.`,
        ``,
        `MEMORY RULE: If you see a [CONVERSATION MEMORY] entry at the start of the conversation history, treat it as a factual briefing from prior sessions — not as a message to respond to.`,
    ];

    // ── Intelligence briefing (dynamic) ────────────────────────────────────────
    const briefingParts: string[] = [];
    if (memory.icpSummary) briefingParts.push(`OPERATOR PROFILE: ${memory.icpSummary}`);
    if (memory.hivePatterns) briefingParts.push(`NETWORK INTELLIGENCE (${flavor.name} community, platform-wide):\n${memory.hivePatterns}`);
    if (memory.leadStats) briefingParts.push(`PIPELINE: ${memory.leadStats}`);

    if (briefingParts.length > 0) {
        lines.push(``);
        lines.push(`INTELLIGENCE BRIEFING — personalize every response using this. Do not repeat it verbatim:`);
        briefingParts.forEach(p => lines.push(p));
    }

    lines.push(
        ``,
        `ONBOARDING RULE — HIGHEST PRIORITY:`,
        `On EVERY incoming user message, your FIRST action must be to call tiger_onboard with action="status".`,
        `If the result shows isComplete=false, you MUST run the onboarding interview before doing anything else.`,
        `- If phase="identity" and no interview has started, call tiger_onboard with action="start".`,
        `- For every subsequent user reply during onboarding, call tiger_onboard with action="respond" and response=<user message>.`,
        `- Do NOT switch to prospecting, scouting, or any other mode until tiger_onboard returns isComplete=true.`,
        `- When tiger_onboard gives you a question to ask or a summary to present, be conversational and direct. Ask one question at a time. Present the core questions accurately. Sound like a smart colleague, not a hype machine.`,
        ``,
        `NORMAL OPERATION (after onboarding complete):`,
        `You are a highly capable general business partner and expert advisor. If the user asks general business questions, brainstorms strategy, or throws an edge case at you, handle it intelligently and organically in-chat. Do NOT say you cannot help.`,
        ``,
        `You ALSO have 19 powerful active capabilities (tools) at your disposal. Call them autonomously when the user's request matches these intentions:`,
        `- User asks to find prospects, discover leads, scan Reddit/Telegram, search for customers, or build a pipeline → call tiger_scout(action="hunt", mode="burst")`,
        `- User says /today, asks for today's report, wants a briefing, or asks who to contact → call tiger_briefing`,
        `- User asks about a specific person or company, wants research on a name → call tiger_search`,
        `- User asks to send a message, reach out, or contact a specific prospect → call tiger_contact`,
        `- User reports a contact replied or responded → call tiger_aftercare`,
        `- User wants to log a note on a contact → call tiger_note`,
        `- User reports a conversion or sign-up → call tiger_convert`,
        `- User asks about their pipeline, lead count, or prospect status → call tiger_scout(action="status")`,
        ``,
        `After every outbound message or AI response, call tiger_keys with action="record_message" to track layer usage.`,
        `If you receive an API error, call tiger_keys with action="report_error" and the HTTP status immediately.`,
        `Never fabricate contact information. Never claim income. Always include an opt-out in outreach.`,
        ``,
        `ANTI-CHURN CRITICAL RULE:`,
        `If the scout reports 0 leads or an empty pipeline, NEVER tell the user to "work their warm market", "talk to friends/family", or make "three-way calls". That defeats the purpose of this software.`,
        `Instead, assure them that you (Tiger Claw) are actively expanding search parameters, scanning new networks, and adjusting algorithms to find them qualified leads. Keep them excited about what the software is doing automatically for them.`,
    );

    return lines.join('\n');
}

// ─── Tool execution loop ─────────────────────────────────────────────────────
async function runToolLoop(
    chat: any,
    initialResponse: any,
    toolContext: any,
    logPrefix: string,
    chatId?: number | string,
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
            if (chatId !== undefined) {
                incrementFocusToolCalls(toolContext.agentId, chatId).catch(() => {});
            }

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

        await startFocus(tenantId, chatId);
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
        const finalResponse = await runToolLoop(chat, initial.response, toolContext, 'AI', chatId);

        const updatedHistory = await chat.getHistory();
        await saveChatHistory(tenantId, chatId, updatedHistory);
        await completeFocus(tenantId, chatId, updatedHistory);
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
        await startFocus(tenantId, chatId);
        const history = await getChatHistory(tenantId, chatId);
        const genAI = new GoogleGenerativeAI(googleKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: await buildSystemPrompt(tenant),
            tools: geminiTools as any,
        });

        const chat = model.startChat({ history });
        const initial = await chat.sendMessage(text);
        const finalResponse = await runToolLoop(chat, initial.response, toolContext, 'AI', chatId);

        const updatedHistory = await chat.getHistory();
        await saveChatHistory(tenantId, chatId, updatedHistory);
        await completeFocus(tenantId, chatId, updatedHistory);

        const replyText = finalResponse.text?.() ?? '';
        if (replyText.trim().length > 0) {
            await sendLineMessage(replyText);
        }
    } catch (err: any) {
        console.error(`[AI] [ALERT] processLINEMessage failed for tenant ${tenantId}:`, err.message);
        await sendLineMessage('❌ Something went wrong. The operator has been notified. Please try again in a moment.');
    }
}
