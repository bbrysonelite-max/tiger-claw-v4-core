import { FLAVOR_REGISTRY } from "../config/flavors/index.js";
import { tiger_refine } from "../tools/tiger_refine.js";
import { isAlreadyMined } from "./market_intel.js";

const REDDIT_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.536";
const REDDIT_HEADERS = { "User-Agent": REDDIT_UA, "Accept": "application/json" };
const DELAY_MS = 1500; // polite delay between requests

// Returns fetch options with Oxylabs residential proxy if configured.
// When OXYLABS_USERNAME + OXYLABS_PASSWORD are set, Reddit requests route
// through residential IPs that bypass the 403 block on Cloud Run egress.
// When not set, returns empty options (existing behavior).
function getOxylabsOptions(): RequestInit {
  const user = process.env["OXYLABS_USERNAME"];
  const pass = process.env["OXYLABS_PASSWORD"];
  if (!user || !pass) return {};

  // Oxylabs residential proxy endpoint
  const proxyAuth = Buffer.from(`${user}:${pass}`).toString("base64");
  return {
    headers: {
      "Proxy-Authorization": `Basic ${proxyAuth}`,
      "X-Oxylabs-Geo-Location": "United States",
    },
  };
}

if (process.env["OXYLABS_USERNAME"]) {
  console.log("[market_miner] Oxylabs proxy active — routing Reddit through residential IP");
}

// ─── Serper key rotation ────────────────────────────────────────────────────
// All three keys are used in round-robin. On a 429, rotate to the next key.
// If all keys are exhausted, return empty and log an admin-level alert.
// serperKeyIndex persists across runs so rotation state survives between
// nightly invocations (if KEY_1 was exhausted last night, next night starts
// from KEY_2). serperCallsThisRun is per-invocation — see makeSerperFetcher.
const SERPER_KEYS: string[] = [
    process.env["SERPER_KEY_1"],
    process.env["SERPER_KEY_2"],
    process.env["SERPER_KEY_3"],
].filter(Boolean) as string[];

let serperKeyIndex = 0;
const SERPER_MAX_CALLS_PER_RUN = 50;

const mockContext: any = {
    sessionKey: "market-miner",
    logger: console,
    config: {},
};

interface MinerPost {
    rawContent: string;
    sourceUrl: string;
    entityId?: string;
}

async function fetchReddit(query: string): Promise<MinerPost[] | null> {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=5`;
    const oxylabs = getOxylabsOptions();
    const res = await fetch(url, {
      ...oxylabs,
      headers: {
        ...(oxylabs.headers as Record<string, string> | undefined),
        ...REDDIT_HEADERS,
      },
    });
    if (!res.ok) return null; // caller will fall back to Serper
    const data = await res.json() as any;
    const posts: any[] = data?.data?.children ?? [];
    return posts.map((post: any) => {
        const { title, selftext, permalink, author } = post.data ?? {};
        return {
            rawContent: `${title ?? ""}\n\n${selftext ?? ""}`.trim(),
            sourceUrl: `https://www.reddit.com${permalink}`,
            entityId: author ? `u/${author}` : undefined,
        };
    }).filter(p => p.rawContent.length >= 20);
}

// Returns a fetchSerper function with its own isolated call counter.
// Each runMarketMining() invocation gets its own instance so concurrent
// mining jobs cannot corrupt each other's cap tracking.
function makeSerperFetcher(): (query: string) => Promise<MinerPost[]> {
    let callsThisRun = 0;

    return async function fetchSerper(query: string): Promise<MinerPost[]> {
        if (SERPER_KEYS.length === 0) return [];
        if (callsThisRun >= SERPER_MAX_CALLS_PER_RUN) {
            console.warn(`[Miner] Serper call cap (${SERPER_MAX_CALLS_PER_RUN}) reached for this run — skipping remaining Serper queries.`);
            return [];
        }

        for (let attempt = 0; attempt < SERPER_KEYS.length; attempt++) {
            const key = SERPER_KEYS[serperKeyIndex % SERPER_KEYS.length];
            callsThisRun++;
            const res = await fetch("https://google.serper.dev/search", {
                method: "POST",
                headers: { "X-API-KEY": key!, "Content-Type": "application/json" },
                body: JSON.stringify({ q: query, num: 5 }),
            });
            if (res.status === 429) {
                console.warn(`[Miner] Serper key ${serperKeyIndex % SERPER_KEYS.length} rate-limited — rotating to next key.`);
                serperKeyIndex++;
                continue;
            }
            if (!res.ok) {
                console.warn(`[Miner] Serper returned ${res.status} for "${query}" — skipping.`);
                return [];
            }
            const data = await res.json() as any;
            const results: any[] = data?.organic ?? [];
            return results.map((r: any) => ({
                rawContent: `${r.title ?? ""}\n\n${r.snippet ?? ""}`.trim(),
                sourceUrl: r.link ?? "",
                entityId: undefined,
            })).filter(p => p.rawContent.length >= 20 && p.sourceUrl);
        }

        // All keys exhausted
        console.error(`[Miner] [ALERT] All ${SERPER_KEYS.length} Serper keys are rate-limited. Returning empty for "${query}".`);
        return [];
    };
}

/**
 * Run one full market intelligence mining pass across all flavors.
 * Fetches fresh Reddit posts for each flavor's scoutQueries,
 * runs them through Gemini extraction, and saves facts to market_intelligence.
 *
 * Called by the BullMQ miningWorker on a daily schedule.
 */
export async function runMarketMining(): Promise<{ flavorsProcessed: number; postsFound: number; factsSaved: number; factsRejected: number }> {
    console.log("[Miner] Starting daily market intelligence run.");
    const fetchSerper = makeSerperFetcher(); // isolated call counter per run

    let flavorsProcessed = 0;
    let postsFound = 0;
    let factsSaved = 0;
    let factsRejected = 0;

    for (const [flavorId, flavor] of Object.entries(FLAVOR_REGISTRY)) {
        if (flavorId === "admin") continue;
        const queries: string[] = (flavor as any).scoutQueries ?? [];
        if (queries.length === 0) continue;

        console.log(`[Miner] --- Flavor: ${(flavor as any).displayName ?? flavorId} ---`);
        flavorsProcessed++;

        for (const query of queries) {
            try {
                let posts: MinerPost[] | null = await fetchReddit(query);
                if (posts === null) {
                    console.warn(`[Miner] Reddit blocked for "${query}" — falling back to Serper.`);
                    posts = await fetchSerper(query);
                } else {
                    console.log(`[Miner] "${query}" → ${posts.length} posts (Reddit)`);
                }

                for (const post of posts) {
                    if (await isAlreadyMined(post.sourceUrl)) {
                        console.log(`[Miner] ⏩ Duplicate — skipping ${post.sourceUrl}`);
                        continue;
                    }

                    postsFound++;

                    const result = await tiger_refine.execute(
                        {
                            rawContent: post.rawContent,
                            sourceUrl: post.sourceUrl,
                            extractionGoal: "intent_signals",
                            domain: (flavor as any).displayName ?? flavorId,
                            capturedBy: "cloud-run-miner",
                            entityId: post.entityId,
                            miningCost: 0.04,
                        },
                        mockContext
                    );

                    if (result.ok) {
                        const facts = (result.data as any)?.facts ?? [];
                        const rejected = (result.data as any)?.rejectedCount ?? 0;
                        factsSaved += facts.length;
                        factsRejected += rejected;
                        console.log(`[Miner] ✅ ${facts.length} facts saved for ${flavorId} (${rejected} rejected)`);
                    } else {
                        console.warn(`[Miner] ⚠️  Refinement failed for ${post.sourceUrl}: ${result.error}`);
                    }
                }

                await new Promise(r => setTimeout(r, DELAY_MS));
            } catch (err) {
                console.error(`[Miner] Error on query "${query}":`, err);
                // Continue — one bad query never stops the run
            }
        }
    }

    console.log(`[Miner] Run complete. Flavors: ${flavorsProcessed}, Posts: ${postsFound}, Facts saved: ${factsSaved}, Facts rejected: ${factsRejected}`);
    return { flavorsProcessed, postsFound, factsSaved, factsRejected };
}
