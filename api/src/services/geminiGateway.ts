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
        throw new Error('unreachable');
    } finally {
        geminiSemaphore.release();
    }
}
