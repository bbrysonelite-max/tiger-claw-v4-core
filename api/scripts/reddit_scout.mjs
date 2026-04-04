// Tiger Claw — Autonomous Multi-Flavor Scout Script
// This script runs on cluster nodes (Monica/Birdie).
// It fetches all active flavors and harvests data for each one.

const API_URL = process.env.TIGER_CLAW_API_URL || 'http://localhost:4000';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

// ─── Serper fallback ─────────────────────────────────────────────────────────
const SERPER_KEYS = [
  process.env.SERPER_KEY_1,
  process.env.SERPER_KEY_2,
  process.env.SERPER_KEY_3,
].filter(Boolean);

let serperKeyIndex = 0;

async function fetchSerperPosts(query) {
  if (SERPER_KEYS.length === 0) return [];
  for (let attempt = 0; attempt < SERPER_KEYS.length; attempt++) {
    const key = SERPER_KEYS[serperKeyIndex % SERPER_KEYS.length];
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (res.status === 429) {
      console.warn(`[scout] Serper key ${serperKeyIndex % SERPER_KEYS.length} rate-limited — rotating.`);
      serperKeyIndex++;
      continue;
    }
    if (!res.ok) {
      console.warn(`[scout] Serper returned ${res.status} for "${query}" — skipping.`);
      return [];
    }
    const data = await res.json();
    return (data?.organic ?? []).map(r => ({
      title: r.title ?? '',
      selftext: r.snippet ?? '',
      permalink: r.link ?? '',
      author: 'serper',
    }));
  }
  console.error(`[scout] All Serper keys exhausted for "${query}".`);
  return [];
}

async function runGlobalScout() {
  console.log(`[scout] Starting Global Multi-Flavor Harvest at ${new Date().toISOString()}`);

  try {
    // 1. Fetch all flavors with scout queries
    const flavorsRes = await fetch(`${API_URL}/flavors`);
    const flavors = await flavorsRes.json();
    console.log(`[scout] Fetched ${flavors.length} flavors from registry.`);

    for (const flavor of flavors) {
      if (!flavor.scoutQueries || flavor.scoutQueries.length === 0) continue;

      console.log(`\n--- Mining Flavor: ${flavor.displayName} (${flavor.key}) ---`);

      for (const query of flavor.scoutQueries) {
        const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=5`;

        try {
          console.log(`[scout] Searching: "${query}"`);
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' } });

          let posts;
          if (!res.ok) {
            console.warn(`[scout] Reddit returned ${res.status} for "${query}" — falling back to Serper.`);
            posts = await fetchSerperPosts(query);
          } else {
            const data = await res.json();
            posts = (data?.data?.children || []).map(p => p.data);
            if (posts.length === 0) {
              console.warn(`[scout] Reddit returned 0 results for "${query}" — falling back to Serper.`);
              posts = await fetchSerperPosts(query);
            }
          }
          console.log(`[scout] Found ${posts.length} raw results.`);

          for (const post of posts) {
            const { title, selftext, permalink, author } = post;
            const rawContent = `${title}\n\n${selftext ?? ''}`;
            // Serper posts already have a full URL; Reddit posts need the base prepended
            const sourceUrl = permalink?.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;

            // Send to the Refinery
            console.log(`[refinery] Sending post by u/${author} for [${flavor.key}] purification...`);
            const refineRes = await fetch(`${API_URL}/mining/refine`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rawContent,
                sourceUrl,
                extractionGoal: 'intent_signals',
                domain: flavor.displayName,
                capturedBy: process.env.CLUSTER_NODE_NAME || 'monica',
                entityId: `u/${author}`,
                miningCost: 0.04 // Mock cost per Reddit fact
              })
            });

            const result = await refineRes.json();
            if (result.ok) {
              console.log(`[refinery] ✅ Purified facts for ${flavor.key}.`);
            }
          }
        } catch (err) {
          console.error(`[scout] Error during search "${query}":`, err);
        }
      }
    }
  } catch (err) {
    console.error("[scout] Fatal error fetching flavors:", err);
  }
}

runGlobalScout();
