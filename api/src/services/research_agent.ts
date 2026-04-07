// Tiger Claw — Research Agent
// Per-flavor market intelligence miner.
// Runs in parallel across all flavors (one BullMQ job per flavor).
//
// Improvements over the legacy sequential market_miner:
//   - 15 results per query (was 5) — wider net
//   - Parallel execution — 8 flavors run simultaneously
//   - Reports completion to Orchestrator for pipeline coordination

import { tiger_refine } from '../tools/tiger_refine.js';
import { isAlreadyMined } from './market_intel.js';
import { reportResearchComplete } from './orchestrator.js';

const RESULTS_PER_QUERY = 15;
const DELAY_MS = 1000;

const SERPER_KEYS: string[] = [
    process.env['SERPER_KEY_1'],
    process.env['SERPER_KEY_2'],
    process.env['SERPER_KEY_3'],
].filter(Boolean) as string[];

let serperKeyIndex = 0;
const SERPER_MAX_CALLS_PER_RUN = 50;

const mockContext: any = {
    sessionKey: 'research-agent',
    logger: console,
    config: {},
};

interface MinerPost {
    rawContent: string;
    sourceUrl: string;
    entityId?: string;
}

// ---------------------------------------------------------------------------
// Oxylabs Realtime API
// Cloud Run egress IPs are blocked by Reddit. Route through residential IPs.
// ---------------------------------------------------------------------------

async function fetchViaOxylabs(targetUrl: string): Promise<string | null> {
    const user = process.env['OXYLABS_USERNAME'];
    const pass = process.env['OXYLABS_PASSWORD'];
    if (!user || !pass) return null;

    const auth = Buffer.from(`${user}:${pass}`).toString('base64');

    try {
        const res = await fetch('https://realtime.oxylabs.io/v1/queries', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'universal',
                url: targetUrl,
                geo_location: 'United States',
            }),
        });

        if (!res.ok) {
            console.warn(`[ResearchAgent] Oxylabs ${res.status} for ${targetUrl}`);
            return null;
        }

        const data = await res.json() as any;
        return data?.results?.[0]?.content ?? null;
    } catch (err: any) {
        console.warn(`[ResearchAgent] Oxylabs error: ${err.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Reddit
// ---------------------------------------------------------------------------

function parseRedditPosts(rawJson: any): MinerPost[] {
    const posts: any[] = rawJson?.data?.children ?? [];
    return posts.map((post: any) => {
        const { title, selftext, permalink, author } = post.data ?? {};
        return {
            rawContent: `${title ?? ''}\n\n${selftext ?? ''}`.trim(),
            sourceUrl: `https://www.reddit.com${permalink}`,
            entityId: author ? `u/${author}` : undefined,
        };
    }).filter(p => p.rawContent.length >= 20);
}

async function fetchReddit(query: string): Promise<MinerPost[] | null> {
    const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${RESULTS_PER_QUERY}`;

    const content = await fetchViaOxylabs(redditUrl);
    if (content !== null) {
        try {
            const data = JSON.parse(content);
            const posts = parseRedditPosts(data);
            console.log(`[ResearchAgent] Oxylabs: "${query.slice(0, 60)}" → ${posts.length} posts`);
            return posts;
        } catch {
            console.warn(`[ResearchAgent] Oxylabs non-JSON for "${query.slice(0, 60)}" — falling back to Serper`);
            return null;
        }
    }

    // Direct fetch (works locally, 403s on Cloud Run without Oxylabs)
    try {
        const res = await fetch(redditUrl, {
            headers: { 'User-Agent': 'TigerClaw-Research/1.0', 'Accept': 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json() as any;
        const posts = parseRedditPosts(data);
        console.log(`[ResearchAgent] Reddit direct: "${query.slice(0, 60)}" → ${posts.length} posts`);
        return posts;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Serper (Google fallback)
// ---------------------------------------------------------------------------

function makeSerperFetcher(): (query: string) => Promise<MinerPost[]> {
    let callsThisRun = 0;

    return async function fetchSerper(query: string): Promise<MinerPost[]> {
        if (SERPER_KEYS.length === 0) return [];
        if (callsThisRun >= SERPER_MAX_CALLS_PER_RUN) {
            console.warn(`[ResearchAgent] Serper cap (${SERPER_MAX_CALLS_PER_RUN}) reached — skipping`);
            return [];
        }

        for (let attempt = 0; attempt < SERPER_KEYS.length; attempt++) {
            const key = SERPER_KEYS[serperKeyIndex % SERPER_KEYS.length];
            callsThisRun++;
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': key!, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: query, num: RESULTS_PER_QUERY }),
            });
            if (res.status === 429) {
                serperKeyIndex++;
                continue;
            }
            if (!res.ok) return [];
            const data = await res.json() as any;
            const results: any[] = data?.organic ?? [];
            return results.map((r: any) => ({
                rawContent: `${r.title ?? ''}\n\n${r.snippet ?? ''}`.trim(),
                sourceUrl: r.link ?? '',
                entityId: undefined,
            })).filter(p => p.rawContent.length >= 20 && p.sourceUrl);
        }

        console.error(`[ResearchAgent] All Serper keys exhausted for "${query.slice(0, 60)}"`);
        return [];
    };
}

// ---------------------------------------------------------------------------
// Core run function
// ---------------------------------------------------------------------------

export async function runResearchAgent(
    runId: string,
    flavorId: string,
    displayName: string,
    queries: string[],
): Promise<{ factsSaved: number; factsRejected: number; postsFound: number }> {
    console.log(`[ResearchAgent] Starting — flavor: ${displayName}, queries: ${queries.length}, run: ${runId}`);

    const fetchSerper = makeSerperFetcher();
    let factsSaved = 0;
    let factsRejected = 0;
    let postsFound = 0;

    for (const query of queries) {
        try {
            let posts: MinerPost[] | null = await fetchReddit(query);
            if (posts === null) {
                posts = await fetchSerper(query);
            }

            for (const post of posts ?? []) {
                if (await isAlreadyMined(post.sourceUrl)) {
                    console.log(`[ResearchAgent] Duplicate — skipping ${post.sourceUrl}`);
                    continue;
                }

                postsFound++;

                const result = await tiger_refine.execute(
                    {
                        rawContent: post.rawContent,
                        sourceUrl: post.sourceUrl,
                        extractionGoal: 'intent_signals',
                        domain: displayName,
                        capturedBy: 'research-agent',
                        entityId: post.entityId,
                        miningCost: 0.04,
                    },
                    mockContext,
                );

                if (result.ok) {
                    const facts = (result.data as any)?.facts ?? [];
                    const rejected = (result.data as any)?.rejectedCount ?? 0;
                    factsSaved += facts.length;
                    factsRejected += rejected;
                } else {
                    console.warn(`[ResearchAgent] Refinement failed for ${post.sourceUrl}: ${result.error}`);
                }
            }

            await new Promise(r => setTimeout(r, DELAY_MS));
        } catch (err) {
            console.error(`[ResearchAgent] Error on query "${query.slice(0, 60)}":`, err);
            // Continue — one bad query never stops the flavor run
        }
    }

    console.log(`[ResearchAgent] ${displayName} complete — posts: ${postsFound}, saved: ${factsSaved}, rejected: ${factsRejected}`);

    // Report back to orchestrator
    await reportResearchComplete(runId, factsSaved).catch(err =>
        console.warn(`[ResearchAgent] Failed to report completion to orchestrator: ${err.message}`)
    );

    return { factsSaved, factsRejected, postsFound };
}
