import { FLAVOR_REGISTRY } from "../config/flavors/index.js";
import { tiger_refine } from "../tools/tiger_refine.js";
import { isAlreadyMined } from "./market_intel.js";

const REDDIT_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const REDDIT_HEADERS = { "User-Agent": REDDIT_UA, "Accept": "application/json" };
const DELAY_MS = 1500; // polite delay between Reddit requests

const mockContext: any = {
    sessionKey: "market-miner",
    logger: console,
    config: {},
};

/**
 * Run one full market intelligence mining pass across all flavors.
 * Fetches fresh Reddit posts for each flavor's scoutQueries,
 * runs them through Gemini extraction, and saves facts to market_intelligence.
 *
 * Called by the BullMQ miningWorker on a daily schedule.
 */
export async function runMarketMining(): Promise<{ flavorsProcessed: number; postsFound: number; factsSaved: number; factsRejected: number }> {
    console.log("[Miner] Starting daily market intelligence run.");

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
            const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=5`;

            try {
                const res = await fetch(url, { headers: REDDIT_HEADERS });
                if (!res.ok) {
                    console.warn(`[Miner] Reddit returned ${res.status} for "${query}" — skipping.`);
                    continue;
                }

                const data = await res.json() as any;
                const posts: any[] = data?.data?.children ?? [];
                console.log(`[Miner] "${query}" → ${posts.length} posts`);

                for (const post of posts) {
                    const { title, selftext, permalink, author } = post.data ?? {};
                    const sourceUrl = `https://www.reddit.com${permalink}`;

                    // Skip if already in the moat
                    if (await isAlreadyMined(sourceUrl)) {
                        console.log(`[Miner] ⏩ Duplicate — skipping ${sourceUrl}`);
                        continue;
                    }

                    const rawContent = `${title ?? ""}\n\n${selftext ?? ""}`.trim();
                    if (rawContent.length < 20) continue;

                    postsFound++;

                    const result = await tiger_refine.execute(
                        {
                            rawContent,
                            sourceUrl,
                            extractionGoal: "intent_signals",
                            domain: (flavor as any).displayName ?? flavorId,
                            capturedBy: "cloud-run-miner",
                            entityId: author ? `u/${author}` : undefined,
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
                        console.warn(`[Miner] ⚠️  Refinement failed for ${sourceUrl}: ${result.error}`);
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
