// Tiger Strike — tiger_strike_harvest Tool
// Engagement Layer: Phase 2 of the Sabbertooth Assimilation
//
// What this tool does:
//   1. Queries the market_intelligence table for new, unengaged, high-confidence facts
//   2. Filters by tenant's flavor (domain) and minimum confidence threshold
//   3. Returns a prioritized batch of engagement-ready leads with full provenance
//   4. Marks retrieved facts as "queued" to prevent duplicate engagement
//
// This tool bridges the Sabbertooth Data Refinery (the swarm harvest) to the
// Tiger Strike engagement layer. It reads from the Sovereign Data Moat and
// feeds tiger_strike_draft and tiger_strike_engage.
//
// Stateless: All state lives in PostgreSQL. No Redis, no local files.

import { getReadPool, getWritePool } from "../services/db.js";
import { loadFlavorConfig } from "./flavorConfig.js";
import type { ToolContext, ToolResult } from "./ToolContext.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HarvestParams {
  action: "fetch" | "status" | "archive";
  min_confidence?: number;
  limit?: number;
  category?: string;
  fact_ids?: string[];
}

interface MarketFact {
  id: string;
  domain: string;
  category: string;
  entity_label: string;
  fact_summary: string;
  source_url: string;
  confidence_score: number;
  engagement_status: string;
  harvested_at: string;
}

interface HarvestSummary {
  total_facts: number;
  unengaged_facts: number;
  queued_facts: number;
  engaged_facts: number;
  archived_facts: number;
  domains: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIDENCE_THRESHOLD = 85;
const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Core: Fetch engagement-ready facts from the Sovereign Data Moat
// ---------------------------------------------------------------------------

async function fetchEngagementBatch(
  tenantId: string,
  flavor: string,
  minConfidence: number,
  limit: number,
  category?: string,
): Promise<MarketFact[]> {
  const pool = getReadPool();
  const flavorConfig = loadFlavorConfig(flavor);
  const domain = flavorConfig.displayName;

  // Build the query — fetch unengaged facts ordered by IPP relevance_score first,
  // then confidence DESC as tiebreaker, then created_at ASC (oldest-first FIFO).
  // Legacy pre-gate facts have NULL relevance_score and sort last (NULLS LAST).
  const params: (string | number)[] = [domain, minConfidence, Math.min(limit, MAX_BATCH_SIZE)];
  let categoryClause = "";
  if (category) {
    categoryClause = " AND mi.category = $4";
    params.push(category);
  }

  const query = `
    SELECT
      mi.id,
      mi.domain,
      mi.category,
      mi.entity_label,
      mi.fact_summary,
      mi.source_url,
      mi.confidence_score,
      COALESCE(mi.engagement_status, 'unengaged') AS engagement_status,
      mi.created_at AS harvested_at
    FROM market_intelligence mi
    WHERE mi.domain = $1
      AND mi.confidence_score >= $2
      AND COALESCE(mi.engagement_status, 'unengaged') = 'unengaged'
      ${categoryClause}
    ORDER BY (mi.metadata->>'relevance_score')::int DESC NULLS LAST,
             mi.confidence_score DESC,
             mi.created_at ASC
    LIMIT $3
  `;

  const result = await pool.query(query, params);
  return result.rows as MarketFact[];
}

// ---------------------------------------------------------------------------
// Core: Mark facts as queued (prevents duplicate engagement)
// ---------------------------------------------------------------------------

async function markFactsQueued(factIds: string[]): Promise<number> {
  if (factIds.length === 0) return 0;
  const pool = getWritePool();
  const placeholders = factIds.map((_, i) => `$${i + 1}`).join(", ");
  const result = await pool.query(
    `UPDATE market_intelligence
     SET engagement_status = 'queued', queued_at = NOW()
     WHERE id IN (${placeholders}) AND COALESCE(engagement_status, 'unengaged') = 'unengaged'`,
    factIds,
  );
  return result.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Core: Archive facts (after engagement or rejection)
// ---------------------------------------------------------------------------

async function archiveFacts(factIds: string[], reason: string): Promise<number> {
  if (factIds.length === 0) return 0;
  const pool = getWritePool();
  const placeholders = factIds.map((_, i) => `$${i + 2}`).join(", ");
  const result = await pool.query(
    `UPDATE market_intelligence
     SET engagement_status = 'archived', archived_at = NOW(), archive_reason = $1
     WHERE id IN (${placeholders})`,
    [reason, ...factIds],
  );
  return result.rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// Core: Pipeline status summary
// ---------------------------------------------------------------------------

async function getPipelineStatus(flavor: string): Promise<HarvestSummary> {
  const pool = getReadPool();
  const flavorConfig = loadFlavorConfig(flavor);
  const domain = flavorConfig.displayName;

  const result = await pool.query(
    `SELECT
       COUNT(*) AS total_facts,
       COUNT(*) FILTER (WHERE COALESCE(engagement_status, 'unengaged') = 'unengaged') AS unengaged_facts,
       COUNT(*) FILTER (WHERE engagement_status = 'queued') AS queued_facts,
       COUNT(*) FILTER (WHERE engagement_status = 'engaged') AS engaged_facts,
       COUNT(*) FILTER (WHERE engagement_status = 'archived') AS archived_facts
     FROM market_intelligence
     WHERE domain = $1`,
    [domain],
  );

  const row = result.rows[0] ?? {};

  // Domain breakdown across all flavors
  const domainResult = await pool.query(
    `SELECT domain, COUNT(*) AS count
     FROM market_intelligence
     WHERE COALESCE(engagement_status, 'unengaged') = 'unengaged'
     GROUP BY domain
     ORDER BY count DESC`,
  );
  const domains: Record<string, number> = {};
  for (const r of domainResult.rows) {
    domains[r.domain] = parseInt(r.count, 10);
  }

  return {
    total_facts: parseInt(row.total_facts ?? "0", 10),
    unengaged_facts: parseInt(row.unengaged_facts ?? "0", 10),
    queued_facts: parseInt(row.queued_facts ?? "0", 10),
    engaged_facts: parseInt(row.engaged_facts ?? "0", 10),
    archived_facts: parseInt(row.archived_facts ?? "0", 10),
    domains,
  };
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(
  params: HarvestParams,
  context: ToolContext,
): Promise<ToolResult> {
  const { sessionKey, config, logger } = context;
  const tenantId = config.TIGER_CLAW_TENANT_ID;
  const flavor = config.BOT_FLAVOR;
  const { action } = params;

  try {
    switch (action) {
      case "fetch": {
        const minConf = params.min_confidence ?? DEFAULT_CONFIDENCE_THRESHOLD;
        const limit = params.limit ?? DEFAULT_BATCH_SIZE;

        const facts = await fetchEngagementBatch(tenantId, flavor, minConf, limit, params.category);

        if (facts.length === 0) {
          return {
            ok: true,
            output: "No unengaged facts above the confidence threshold. The swarm may need to run another harvest, or lower the threshold.",
            data: { facts: [], count: 0 },
          };
        }

        // Mark as queued to prevent duplicate engagement
        const factIds = facts.map((f) => f.id);
        const queued = await markFactsQueued(factIds);

        logger.info(`tiger_strike_harvest: fetched ${facts.length} facts, queued ${queued}`, { tenantId });

        return {
          ok: true,
          output: `Fetched ${facts.length} engagement-ready facts (confidence ≥ ${minConf}). All marked as queued. Pass these to tiger_strike_draft to generate replies.`,
          data: { facts, count: facts.length, queued },
        };
      }

      case "status": {
        const summary = await getPipelineStatus(flavor);
        logger.info("tiger_strike_harvest: status", { tenantId, summary });

        return {
          ok: true,
          output:
            `Pipeline status for ${flavor}:\n` +
            `  Total facts: ${summary.total_facts}\n` +
            `  Unengaged: ${summary.unengaged_facts}\n` +
            `  Queued: ${summary.queued_facts}\n` +
            `  Engaged: ${summary.engaged_facts}\n` +
            `  Archived: ${summary.archived_facts}\n` +
            `\nUnengaged facts by domain:\n` +
            Object.entries(summary.domains)
              .map(([d, c]) => `  ${d}: ${c}`)
              .join("\n"),
          data: summary,
        };
      }

      case "archive": {
        if (!params.fact_ids || params.fact_ids.length === 0) {
          return { ok: false, error: "archive action requires fact_ids array." };
        }
        const archived = await archiveFacts(params.fact_ids, "manual_archive");
        logger.info(`tiger_strike_harvest: archived ${archived} facts`, { tenantId });
        return {
          ok: true,
          output: `Archived ${archived} fact(s).`,
          data: { archived },
        };
      }

      default:
        return {
          ok: false,
          error: `Unknown action: "${action}". Valid actions: fetch | status | archive`,
        };
    }
  } catch (err) {
    logger.error("tiger_strike_harvest error", { action, err: String(err) });
    return {
      ok: false,
      error: `tiger_strike_harvest error in action "${action}": ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool export
// ---------------------------------------------------------------------------

export const tiger_strike_harvest = {
  name: "tiger_strike_harvest",
  description:
    "Reads the Sovereign Data Moat (market_intelligence table) for engagement-ready facts. " +
    "Call with action: 'fetch' to pull a prioritized batch of high-confidence leads for the tenant's flavor. " +
    "Call with action: 'status' to see pipeline counts. " +
    "Call with action: 'archive' to remove stale or irrelevant facts. " +
    "Facts are automatically marked as 'queued' on fetch to prevent duplicate engagement.",

  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["fetch", "status", "archive"],
        description:
          "'fetch' — pull unengaged facts for drafting. 'status' — pipeline summary. 'archive' — remove facts by ID.",
      },
      min_confidence: {
        type: "number",
        description: "Minimum confidence score (0-100). Default: 85. Lower to widen the net.",
      },
      limit: {
        type: "number",
        description: "Max facts to return per fetch. Default: 20, max: 100.",
      },
      category: {
        type: "string",
        description: "Filter by fact category (e.g., 'intent_signal', 'objection', 'pain_point').",
      },
      fact_ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of fact IDs for the archive action.",
      },
    },
    required: ["action"],
  },

  execute,
};

export default tiger_strike_harvest;
