// Tiger Claw — Orchestrator
// Top-level coordinator for the daily agent pipeline.
// Spawns Research Agent jobs per flavor (parallel), tracks completion,
// then triggers the Reporting Agent.
//
// Pipeline:
//   Orchestrator → Research Agent Fleet (parallel, 1 per flavor)
//                → Reporting Agent (after all research complete)

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env['REDIS_URL'];
if (!redisUrl) throw new Error('[FATAL] REDIS_URL required for orchestrator');

export const orchestratorConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
});

export const orchestratorQueue = new Queue('tiger-orchestrator', { connection: orchestratorConnection as any });
export const researchAgentQueue = new Queue('research-agent', { connection: orchestratorConnection as any });
export const reportingAgentQueue = new Queue('reporting-agent', { connection: orchestratorConnection as any });

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

export interface OrchestratorRunData {
    runId: string;
    triggeredAt: string;
}

export interface ResearchAgentJobData {
    runId: string;
    flavorId: string;
    displayName: string;
    queries: string[];
}

export interface ReportingAgentJobData {
    runId: string;
    startedAt: string;
    flavorsProcessed: number;
}

// ---------------------------------------------------------------------------
// Orchestrator logic
// ---------------------------------------------------------------------------

/**
 * Start a full orchestrated daily run.
 * Spawns one Research Agent job per active flavor — all run in parallel.
 */
export async function startOrchestratedRun(runId: string): Promise<void> {
    const { FLAVOR_REGISTRY } = await import('../config/flavors/index.js');

    const flavors = Object.entries(FLAVOR_REGISTRY).filter(([id, f]) => {
        if (id === 'admin') return false;
        const queries = (f as any).scoutQueries ?? [];
        return queries.length > 0;
    });

    const count = flavors.length;
    const startedAt = new Date().toISOString();

    // Store run state in Redis (TTL: 24h)
    await orchestratorConnection.set(`orchestrator:run:${runId}:expected`,   String(count), 'EX', 86400);
    await orchestratorConnection.set(`orchestrator:run:${runId}:completed`,  '0',           'EX', 86400);
    await orchestratorConnection.set(`orchestrator:run:${runId}:facts_saved`, '0',          'EX', 86400);
    await orchestratorConnection.set(`orchestrator:run:${runId}:started_at`, startedAt,     'EX', 86400);

    console.log(`[Orchestrator] Run ${runId} started — spawning ${count} Research Agent jobs`);

    for (const [flavorId, flavor] of flavors) {
        const queries: string[] = (flavor as any).scoutQueries ?? [];
        await researchAgentQueue.add('research', {
            runId,
            flavorId,
            displayName: (flavor as any).displayName ?? flavorId,
            queries,
        } satisfies ResearchAgentJobData, {
            jobId: `research_${runId}_${flavorId}`,
            removeOnComplete: true,
            removeOnFail: { count: 100 },
            attempts: 2,
            backoff: { type: 'exponential', delay: 10000 },
        });
    }

    console.log(`[Orchestrator] ${count} Research Agent jobs enqueued`);
}

/**
 * Called by each Research Agent on completion.
 * When all agents have reported in, triggers the Reporting Agent.
 */
export async function reportResearchComplete(runId: string, factsSaved: number): Promise<void> {
    await orchestratorConnection.incrby(`orchestrator:run:${runId}:facts_saved`, factsSaved);
    const completed = await orchestratorConnection.incr(`orchestrator:run:${runId}:completed`);
    const expectedStr = await orchestratorConnection.get(`orchestrator:run:${runId}:expected`);
    const expected = parseInt(expectedStr ?? '0', 10);
    const startedAt = await orchestratorConnection.get(`orchestrator:run:${runId}:started_at`) ?? new Date().toISOString();

    console.log(`[Orchestrator] Research progress: ${completed}/${expected} flavors complete (run: ${runId})`);

    if (completed >= expected) {
        // One-shot guard — only trigger Reporting Agent once per run.
        // Research Agent failure retries can push `completed` past `expected`,
        // and removeOnComplete:true clears the BullMQ dedup key. SETNX prevents
        // the reporting agent from firing more than once for the same runId.
        const claimed = await orchestratorConnection.setnx(`orchestrator:run:${runId}:reported`, '1');
        await orchestratorConnection.expire(`orchestrator:run:${runId}:reported`, 86400);
        if (!claimed) {
            console.log(`[Orchestrator] Reporting Agent already triggered for run ${runId} — skipping duplicate`);
            return;
        }

        const totalStr = await orchestratorConnection.get(`orchestrator:run:${runId}:facts_saved`);
        const totalFacts = parseInt(totalStr ?? '0', 10);
        console.log(`[Orchestrator] All research complete. Total facts: ${totalFacts}. Triggering Reporting Agent.`);

        await reportingAgentQueue.add('report', {
            runId,
            startedAt,
            flavorsProcessed: expected,
        } satisfies ReportingAgentJobData, {
            jobId: `reporting_${runId}`,
            removeOnComplete: true,
            removeOnFail: { count: 100 },
        });
    }
}
