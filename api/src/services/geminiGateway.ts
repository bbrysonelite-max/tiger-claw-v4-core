// geminiGateway.ts — Gemini call semaphore + exponential backoff (Phase 5 Task #15)
//
// Extracted here (not in ai.ts) to avoid a circular import:
//   ai.ts → imports tools (tiger_strike_draft, etc.)
//   tools → need callGemini
//   callGemini in ai.ts → circular
//
// This file has zero imports from ai.ts or the tool layer, so any module
// in the codebase can import it safely.

// ─── Error classifier ────────────────────────────────────────────────────────
// Duplicated from ai.ts so this file stays self-contained.
// Keep in sync if ai.ts classifier changes.

export function classifyAIError(err: unknown): 'key' | 'rate' | 'server' | 'network' | 'general' {
    const msg = ((err as any)?.message ?? String(err)).toLowerCase();
    if (/401|403|api.?key.?invalid|invalid.?key|authentication|permission.?denied|api_key/i.test(msg)) return 'key';
    if (/429|quota|rate.?limit|resource.*exhausted|too many requests/i.test(msg)) return 'rate';
    if (/500|502|503|504|internal.?error|server.?error/i.test(msg)) return 'server';
    if (/econnreset|etimedout|fetch.*failed|network|timeout|socket hang up/i.test(msg)) return 'network';
    return 'general';
}

// ─── Semaphore ───────────────────────────────────────────────────────────────
// Process-level — one instance per Cloud Run pod. Controls how many Gemini
// calls are in-flight simultaneously. GEMINI_CONCURRENCY env var (default: 10).

const GEMINI_MAX_CONCURRENT = parseInt(process.env['GEMINI_CONCURRENCY'] ?? '10', 10);

class Semaphore {
    private permits: number;
    private waiters: (() => void)[] = [];

    constructor(permits: number) {
        this.permits = permits;
    }

    async acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--;
            return;
        }
        return new Promise<void>(resolve => this.waiters.push(resolve));
    }

    release(): void {
        const next = this.waiters.shift();
        if (next) {
            next();
        } else {
            this.permits++;
        }
    }
}

const geminiSemaphore = new Semaphore(GEMINI_MAX_CONCURRENT);

// ─── callGemini ──────────────────────────────────────────────────────────────
// Wraps every Gemini API call with:
//   1. Semaphore — blocks if GEMINI_MAX_CONCURRENT calls already in-flight
//   2. Exponential backoff — retries 429/quota errors up to 3 times
//
// Retry delays: ~1s, ~2s, ~4s (+ up to 500ms jitter). Non-rate errors throw immediately.

// ─── sanitizeGeminiJSON ──────────────────────────────────────────────────────
// Gemini sometimes emits invalid escape sequences (\x27, \', \a, \v) or
// unescaped control characters even when responseMimeType is "application/json".
// Node's JSON.parse() is strict and rejects all of these.

export function sanitizeGeminiJSON(raw: string): string {
    // Strip markdown code fences if present
    let s = raw.trim();
    if (s.startsWith("```json")) s = s.slice(7);
    else if (s.startsWith("```")) s = s.slice(3);
    if (s.endsWith("```")) s = s.slice(0, -3);
    s = s.trim();

    // Fix invalid escape sequences inside JSON strings.
    // Walk character-by-character to only fix escapes inside quoted strings.
    let result = "";
    let inString = false;
    let i = 0;
    while (i < s.length) {
        const ch = s[i];

        if (ch === '"' && (i === 0 || s[i - 1] !== "\\")) {
            inString = !inString;
            result += ch;
            i++;
            continue;
        }

        if (inString && ch === "\\") {
            const next = s[i + 1];
            if (next === undefined) {
                // Trailing backslash — drop it
                i++;
                continue;
            }
            // Valid JSON escapes: " \ / b f n r t u
            if ('"\\/bfnrtu'.includes(next)) {
                result += ch + next;
                i += 2;
                continue;
            }
            // \xNN hex escape (not valid JSON) — convert to \u00NN
            if (next === "x" && i + 3 < s.length) {
                const hex = s.slice(i + 2, i + 4);
                if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                    result += "\\u00" + hex;
                    i += 4;
                    continue;
                }
            }
            // \' — common from LLMs, just emit the apostrophe
            if (next === "'") {
                result += "'";
                i += 2;
                continue;
            }
            // Any other invalid escape (\a, \v, \w, etc.) — drop the backslash
            result += next;
            i += 2;
            continue;
        }

        // Unescaped control characters inside strings
        if (inString && ch.charCodeAt(0) < 32) {
            if (ch === "\n") result += "\\n";
            else if (ch === "\r") result += "\\r";
            else if (ch === "\t") result += "\\t";
            else result += "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
            i++;
            continue;
        }

        result += ch;
        i++;
    }

    return result;
}

// callGemini: 4 attempts (0–3). On attempt 3 (or any non-rate error), throws immediately.
export async function callGemini<T>(fn: () => Promise<T>): Promise<T> {
    await geminiSemaphore.acquire();
    try {
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                return await fn();
            } catch (err) {
                if (classifyAIError(err) !== 'rate' || attempt === 3) throw err;
                const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 15_000);
                console.warn(`[Gemini] 429 rate limit — attempt ${attempt + 1}/4, retrying in ${Math.round(delay)}ms`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
        // TypeScript requires a return path — loop always throws on attempt 3, but TS can't infer that
        throw new Error('[Gemini] callGemini: all 4 attempts exhausted');
    } finally {
        geminiSemaphore.release();
    }
}
