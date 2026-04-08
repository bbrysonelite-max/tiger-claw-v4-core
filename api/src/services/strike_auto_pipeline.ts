// Tiger Claw — Strike Auto Pipeline
// Runs after the 2 AM mine cycle completes (called by Reporting Agent).
//
// Pipeline:
//   1. Harvest top 20 unengaged facts (confidence ≥ 70) from market_intelligence
//   2. Draft contextual replies using platform Gemini key
//   3. Generate Web Intent URLs (X, Reddit) — operator clicks to post
//   4. Send admin Telegram alert with one-click engagement links
//   5. Mark harvested facts as 'queued'

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPool, getReadPool } from './db.js';
import { sendAdminAlert } from '../routes/admin.js';

const HARVEST_LIMIT = 20;
const MIN_CONFIDENCE = 70;

interface HarvestedFact {
    id: string;
    domain: string;
    fact_summary: string;
    verbatim: string | null;
    source_url: string;
    confidence_score: number;
}

interface StrikeLink {
    platform: string;
    url: string;
    preview: string;
}

export async function runStrikeAutoPipeline(): Promise<void> {
    console.log('[StrikePipeline] Starting post-mine strike pipeline');

    const platformKey = process.env['PLATFORM_ONBOARDING_KEY'] ?? process.env['GOOGLE_API_KEY'];
    if (!platformKey) {
        console.warn('[StrikePipeline] No platform Gemini key — skipping pipeline');
        return;
    }

    // 1. Harvest top unengaged facts
    const facts = await harvestFacts();
    if (facts.length === 0) {
        console.log('[StrikePipeline] No unengaged facts to process');
        return;
    }
    console.log(`[StrikePipeline] Harvested ${facts.length} facts`);

    // 2. Draft replies using platform Gemini key
    const drafts = await draftReplies(facts, platformKey);
    if (drafts.length === 0) {
        console.log('[StrikePipeline] No drafts generated');
        return;
    }

    // 3. Generate Web Intent URLs
    const links = generateIntentLinks(facts, drafts);

    // 4. Send admin alert with links
    await sendStrikeReport(facts.length, links);

    // 5. Mark facts as queued
    await markFactsQueued(facts.map(f => f.id));

    console.log(`[StrikePipeline] Done — ${links.length} engagement links generated`);
}

async function harvestFacts(): Promise<HarvestedFact[]> {
    const pool = getReadPool();
    const { rows } = await pool.query<HarvestedFact>(`
        SELECT id, domain, fact_summary, verbatim, source_url, confidence_score
        FROM market_intelligence
        WHERE COALESCE(engagement_status, 'unengaged') = 'unengaged'
          AND confidence_score >= $1
          AND source_url IS NOT NULL
          AND source_url != ''
        ORDER BY confidence_score DESC, created_at DESC
        LIMIT $2
    `, [MIN_CONFIDENCE, HARVEST_LIMIT]);
    return rows;
}

async function draftReplies(facts: HarvestedFact[], apiKey: string): Promise<string[]> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a helpful, plain-spoken person who has built a successful network marketing business over 39 years. You are NOT selling anything in this reply. You are responding to real people expressing real pain about money, job security, or income.

For each fact below, write a SHORT (1-3 sentence) public reply that:
- Acknowledges their specific pain point
- Offers one genuine insight or reframe
- Ends with a soft, curiosity-driven CTA that mentions a bot can help: "If you want to explore this, message @bot"
- Sounds human. Never sounds salesy. No exclamation marks. No hype.

Output ONLY a JSON array of reply strings, one per fact, in the same order as the input. Nothing else.

Facts:
${facts.map((f, i) => `${i + 1}. [${f.domain}] ${f.fact_summary}${f.verbatim ? '\nQuote: "' + f.verbatim.slice(0, 200) + '"' : ''}`).join('\n\n')}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        const parsed = JSON.parse(jsonMatch[0]) as unknown;
        if (!Array.isArray(parsed)) return [];
        return (parsed as unknown[]).map(r => String(r));
    } catch (err) {
        console.warn('[StrikePipeline] Draft generation failed:', err);
        return [];
    }
}

function generateIntentLinks(facts: HarvestedFact[], drafts: string[]): StrikeLink[] {
    const links: StrikeLink[] = [];
    const count = Math.min(facts.length, drafts.length);

    for (let i = 0; i < count; i++) {
        const fact = facts[i]!;
        const reply = drafts[i]!;
        if (!reply) continue;

        const encodedReply = encodeURIComponent(reply);
        const sourceUrl = fact.source_url;

        if (sourceUrl.includes('reddit.com')) {
            // Reddit deep link — opens comment thread
            links.push({
                platform: 'Reddit',
                url: `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}reply=${encodedReply}`,
                preview: `[${fact.domain}] ${fact.fact_summary.slice(0, 60)}...`,
            });
        } else {
            // X/Twitter intent URL as fallback
            const tweetText = `${reply.slice(0, 240)}`;
            links.push({
                platform: 'X',
                url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
                preview: `[${fact.domain}] ${fact.fact_summary.slice(0, 60)}...`,
            });
        }
    }

    return links;
}

async function sendStrikeReport(factCount: number, links: StrikeLink[]): Promise<void> {
    if (links.length === 0) return;

    const grouped: Record<string, StrikeLink[]> = {};
    for (const link of links) {
        if (!grouped[link.platform]) grouped[link.platform] = [];
        grouped[link.platform]!.push(link);
    }

    const lines: string[] = [
        `🎯 Strike Pipeline — ${links.length} engagement links ready`,
        `Facts processed: ${factCount} | Click any link to post\n`,
    ];

    for (const [platform, platformLinks] of Object.entries(grouped)) {
        lines.push(`${platform} (${platformLinks.length}):`);
        for (const link of platformLinks.slice(0, 5)) {
            lines.push(`• ${link.preview}`);
            lines.push(`  ${link.url}`);
        }
        lines.push('');
    }

    await sendAdminAlert(lines.join('\n')).catch(err =>
        console.warn('[StrikePipeline] Admin alert failed:', err)
    );
}

async function markFactsQueued(factIds: string[]): Promise<void> {
    if (factIds.length === 0) return;
    const pool = getPool();
    const placeholders = factIds.map((_, i) => `$${i + 1}`).join(', ');
    await pool.query(
        `UPDATE market_intelligence
         SET engagement_status = 'queued', queued_at = NOW()
         WHERE id IN (${placeholders})
           AND COALESCE(engagement_status, 'unengaged') = 'unengaged'`,
        factIds
    ).catch(err => console.warn('[StrikePipeline] markFactsQueued failed:', err));
}
