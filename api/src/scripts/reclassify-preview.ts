// reclassify-preview.ts
// Read-only diagnostic: runs existing market_intelligence rows through the new
// IPP relevance gate and writes a local JSON report. Does NOT write to the DB.
//
// Usage (local): cloud-sql-proxy on port 5433, then:
//   cd api && npx tsx src/scripts/reclassify-preview.ts
//
// Report lands in api/tmp/reclassify-preview-<timestamp>.json

import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getPool } from '../services/db.js';
import { runIPPGate, type RefinedFact } from '../tools/tiger_refine.js';
import { NETWORK_MARKETER_FLAVOR } from '../config/flavors/network-marketer.js';

const DOMAIN = 'Network Marketer';
const BATCH_SIZE = 20;

async function main() {
    const profile = NETWORK_MARKETER_FLAVOR.idealProspectProfile;
    if (!profile) {
        console.error('[reclassify-preview] network-marketer flavor has no idealProspectProfile — aborting');
        process.exit(1);
    }

    const apiKey = process.env['GOOGLE_API_KEY'];
    if (!apiKey) {
        console.error('[reclassify-preview] GOOGLE_API_KEY missing — aborting');
        process.exit(1);
    }

    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT id, fact_summary, confidence_score, source_url, metadata, verified_at
         FROM market_intelligence
         WHERE domain = $1
         ORDER BY verified_at DESC`,
        [DOMAIN],
    );

    console.log(`[reclassify-preview] Loaded ${rows.length} rows for domain "${DOMAIN}"`);
    if (rows.length === 0) {
        console.log('[reclassify-preview] Nothing to classify — exiting');
        process.exit(0);
    }

    type Scored = {
        id: string;
        fact_summary: string;
        source_url: string;
        confidence_score: number;
        relevance_score: number;
        relevance_reason: string;
        kept: boolean;
    };

    const scored: Scored[] = [];
    let errored = 0;
    let preFiltered = 0;

    // Pre-filter: rows whose source URL matches the blocklist are rejected
    // before hitting the gate. Mirrors tiger_refine.execute() runtime behavior.
    const blocklist = profile.sourceUrlBlocklist ?? [];
    const isBlocked = (url: string) => blocklist.some(pat => url.includes(pat));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        // Split batch into blocked vs classifiable
        const blockedRows = batch.filter((r: any) => isBlocked(r.source_url));
        const classifiableRows = batch.filter((r: any) => !isBlocked(r.source_url));

        for (const row of blockedRows) {
            preFiltered++;
            scored.push({
                id: row.id,
                fact_summary: row.fact_summary,
                source_url: row.source_url,
                confidence_score: row.confidence_score,
                relevance_score: 0,
                relevance_reason: 'pre-filtered: source URL blocklisted',
                kept: false,
            });
        }

        if (classifiableRows.length === 0) {
            console.log(`[reclassify-preview] Batch ${i}-${i + batch.length}: all ${batch.length} pre-filtered (blocklist)`);
            continue;
        }

        const facts: RefinedFact[] = classifiableRows.map((r: any) => ({
            type: 'intent_signal',
            sourceUrl: r.source_url,
            verbatim: r.metadata?.verbatim ?? '',
            purifiedFact: r.fact_summary,
            confidenceScore: r.confidence_score,
            metadata: r.metadata ?? {},
        }));

        try {
            const { kept } = await runIPPGate(apiKey, DOMAIN, profile, facts, console as any);
            // Build a map from purifiedFact → keep result. The gate only returns kept
            // facts, so any row missing from `kept` was rejected.
            const keptByFact = new Map<string, RefinedFact>();
            for (const f of kept) keptByFact.set(f.purifiedFact, f);

            for (const row of classifiableRows) {
                const k = keptByFact.get(row.fact_summary);
                scored.push({
                    id: row.id,
                    fact_summary: row.fact_summary,
                    source_url: row.source_url,
                    confidence_score: row.confidence_score,
                    relevance_score: k ? (k.metadata?.relevance_score ?? 0) : 0,
                    relevance_reason: k ? (k.metadata?.relevance_reason ?? '') : 'rejected by gate',
                    kept: !!k,
                });
            }
            console.log(`[reclassify-preview] Batch ${i}-${i + batch.length}: kept=${kept.length}/${classifiableRows.length} (pre-filtered ${blockedRows.length})`);
        } catch (err) {
            errored += batch.length;
            console.error(`[reclassify-preview] Batch ${i}-${i + batch.length} failed:`, err);
        }

        // Gentle rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    const keptCount = scored.filter(s => s.kept).length;
    const rejectedCount = scored.length - keptCount;

    const sortedByScore = [...scored].sort((a, b) => b.relevance_score - a.relevance_score);
    const top10 = sortedByScore.slice(0, 10);
    const bottom10 = sortedByScore.slice(-10).reverse();
    const borderline10 = [...scored]
        .filter(s => s.relevance_score >= 40 && s.relevance_score <= 70)
        .slice(0, 10);

    const report = {
        generatedAt: new Date().toISOString(),
        domain: DOMAIN,
        totals: {
            rowsClassified: scored.length,
            kept: keptCount,
            rejected: rejectedCount,
            errored,
        },
        top10,
        bottom10,
        borderline10,
    };

    const outDir = join(process.cwd(), 'tmp');
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, `reclassify-preview-${Date.now()}.json`);
    writeFileSync(outFile, JSON.stringify(report, null, 2));

    console.log(`[reclassify-preview] Wrote ${outFile}`);
    console.log(`[reclassify-preview] Totals: kept=${keptCount}, rejected=${rejectedCount}, errored=${errored}`);

    process.exit(0);
}

main().catch(err => {
    console.error('[reclassify-preview] Fatal:', err);
    process.exit(1);
});
