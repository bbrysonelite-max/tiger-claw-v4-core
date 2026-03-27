// Tiger Claw — Autonomous Multi-Flavor Scout Script
// This script runs on cluster nodes (Monica/Birdie).
// It fetches all active flavors and harvests data for each one.

const API_URL = process.env.TIGER_CLAW_API_URL || 'http://localhost:4000';
const USER_AGENT = 'TigerClaw-Cluster-Worker/1.0';

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
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
          const data = await res.json();

          const posts = data?.data?.children || [];
          console.log(`[scout] Found ${posts.length} raw results.`);

          for (const post of posts) {
            const { title, selftext, permalink, author } = post.data;
            const rawContent = `${title}\n\n${selftext}`;
            const sourceUrl = `https://www.reddit.com${permalink}`;

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
