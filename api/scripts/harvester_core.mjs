// Tiger Claw — Harvester Core v2 (Site-Agnostic)
// Uses Playwright with Stealth to mine modern web apps.

import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

const API_URL = process.env.TIGER_CLAW_API_URL || 'http://localhost:4000';
const NODE_NAME = process.env.CLUSTER_NODE_NAME || 'monica';

/**
 * The core harvesting engine.
 */
async function harvest(url, flavor) {
  console.log(`[harvester] Node [${NODE_NAME}] starting harvest: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Navigate and wait for content
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    
    // 2. Perform adaptive scrolling (triggers lazy-loaded content)
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });

    // 3. Extract raw text content
    const rawContent = await page.innerText('body');
    console.log(`[harvester] Extracted ${rawContent.length} chars.`);

    // 4. Send to the Refinery
    console.log(`[refinery] Sending to purification...`);
    const refineRes = await fetch(`${API_URL}/mining/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawContent,
        sourceUrl: url,
        extractionGoal: 'intent_signals',
        domain: flavor.displayName,
        capturedBy: NODE_NAME,
        entityId: `web:${Buffer.from(url).toString('base64').slice(0, 12)}`, // Generate stable ID for web sources
        miningCost: 0.08 // Browser scrapes are more expensive
      })
    });

    const result = await refineRes.json();
    if (result.ok) {
      console.log(`[refinery] ✅ Purified ${result.data.facts.length} facts for ${flavor.key}.`);
    } else if (result.data?.duplicated) {
      console.log(`[refinery] ⏩ Skipping duplicate: ${url}`);
    } else {
      console.error(`[refinery] ❌ Failed: ${result.error}`);
    }

  } catch (err) {
    console.error(`[harvester] Error harvesting ${url}:`, err);
  } finally {
    await browser.close();
  }
}

/**
 * Main loop: fetches targets from the API and mines them.
 */
async function runLoop() {
  try {
    const flavorsRes = await fetch(`${API_URL}/flavors`);
    const flavors = await flavorsRes.json();

    for (const flavor of flavors) {
      if (!flavor.scoutQueries || flavor.scoutQueries.length === 0) continue;
      
      console.log(`\n--- Active Mining: ${flavor.displayName} ---`);
      
      // For v2, we use a simple search engine to find URLs if queries exist
      // In a full implementation, this calls a 'scout' service.
      // For the prototype, we simulate finding a high-intent URL.
      const targetUrls = [
        `https://www.google.com/search?q=${encodeURIComponent(flavor.scoutQueries[0])}`
      ];

      for (const url of targetUrls) {
        await harvest(url, flavor);
      }
    }
  } catch (err) {
    console.error("[harvester] Loop error:", err);
  }
}

runLoop();
