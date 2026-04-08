// Tiger Claw — Reporting Agent
// Triggered by the Orchestrator after all Research Agents complete.
// Generates the daily intelligence brief and sends to admin.

import { getPool, logAdminEvent } from './db.js';
import { sendAdminAlert } from '../routes/admin.js';
import { runStrikeAutoPipeline } from './strike_auto_pipeline.js';

export async function runReportingAgent(
    runId: string,
    startedAt: string,
    flavorsProcessed: number,
): Promise<void> {
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];
    const durationMs = Date.now() - new Date(startedAt).getTime();
    const durationMin = Math.round(durationMs / 60000);

    console.log(`[ReportingAgent] Generating daily brief for run ${runId}`);

    const { rows } = await pool.query<{ domain: string; count: string; avg_confidence: string }>(`
        SELECT domain, COUNT(*) AS count, ROUND(AVG(confidence_score)) AS avg_confidence
        FROM market_intelligence
        WHERE DATE(created_at AT TIME ZONE 'UTC') = $1
        GROUP BY domain
        ORDER BY COUNT(*) DESC
    `, [today]);

    const totalFacts = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    if (totalFacts === 0) {
        await sendAdminAlert(
            `📊 Daily Mine Report — ${today}\n\n` +
            `No new facts saved.\n` +
            `Flavors processed: ${flavorsProcessed}\n` +
            `Duration: ~${durationMin} min`
        ).catch(() => {});
        return;
    }

    const domainLines = rows
        .map(r => `  ${r.domain}: ${r.count} facts (avg confidence: ${r.avg_confidence})`)
        .join('\n');

    await sendAdminAlert(
        `📊 Daily Mine Report — ${today}\n\n` +
        `Flavors: ${flavorsProcessed} | Facts saved: ${totalFacts} | Duration: ~${durationMin} min\n\n` +
        `By flavor:\n${domainLines}`
    ).catch(() => {});

    await logAdminEvent('mine_complete', undefined, {
        runId,
        flavorsProcessed,
        factsSaved: totalFacts,
        durationMin,
    }).catch(() => {});

    console.log(`[ReportingAgent] Brief sent — ${totalFacts} facts across ${flavorsProcessed} flavors`);

    // Trigger Strike auto-pipeline: harvest → draft → Web Intent URLs → admin alert
    runStrikeAutoPipeline().catch(err =>
        console.warn('[ReportingAgent] Strike pipeline failed (non-fatal):', err)
    );
}
