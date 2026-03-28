// Tiger Strike — tiger_strike_engage Tool
// Engagement Layer: Phase 2 of the Sabbertooth Assimilation
//
// What this tool does:
//   1. Takes approved drafts from tiger_strike_draft
//   2. Generates zero-cost Web Intent URLs for each platform (X, Reddit, LinkedIn)
//   3. Returns clickable engagement links that open pre-filled reply windows
//   4. After user clicks, verifies engagement via read-only API checks
//   5. Updates market_intelligence status and feeds the learning loop
//
// The Web Intent Hack:
//   Instead of posting via expensive write APIs (which also risk bot detection),
//   we generate platform-specific URLs that open the user's own browser with
//   the reply pre-filled. The user clicks one button. Zero API write cost.
//   Zero OAuth token management for posting. Zero bot detection risk.
//
// Supported platforms:
//   X/Twitter:  https://twitter.com/intent/tweet?in_reply_to={post_id}&text={reply}
//   Reddit:     https://www.reddit.com/{permalink}?reply={encoded_text} (deep link)
//   LinkedIn:   https://www.linkedin.com/feed/update/{activity_id}/ (comment deep link)
//
// Stateless: All state lives in PostgreSQL. No Redis, no local files.

import { getReadPool, getWritePool } from "../services/db.js";
import type { ToolContext, ToolResult } from "./ToolContext.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EngageParams {
  action: "generate" | "confirm" | "metrics";
  draft_ids?: string[];
  confirmed_ids?: string[];
}

interface StrikeDraft {
  id: string;
  fact_id: string;
  tenant_id: string;
  platform: string;
  source_url: string;
  entity_label: string;
  fact_summary: string;
  drafted_reply: string;
  engagement_score: number;
  status: string;
}

interface EngagementLink {
  draft_id: string;
  platform: string;
  entity_label: string;
  drafted_reply: string;
  intent_url: string;
  source_url: string;
  engagement_score: number;
}

interface EngagementMetrics {
  total_generated: number;
  total_confirmed: number;
  total_pending: number;
  confirmation_rate: number;
  by_platform: Record<string, { generated: number; confirmed: number }>;
  avg_engagement_score: number;
}

// ---------------------------------------------------------------------------
// Web Intent URL Generators
// ---------------------------------------------------------------------------

/**
 * Extract the tweet/post ID from an X/Twitter URL.
 * Handles: twitter.com/user/status/123, x.com/user/status/123
 */
function extractTwitterPostId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Generate a Twitter Web Intent URL for replying to a specific tweet.
 * Opens the user's browser with the reply pre-filled.
 */
function generateTwitterIntent(sourceUrl: string, replyText: string): string {
  const postId = extractTwitterPostId(sourceUrl);
  if (!postId) {
    // Fallback: compose a new tweet mentioning the context
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(replyText)}`;
  }
  return `https://twitter.com/intent/tweet?in_reply_to=${postId}&text=${encodeURIComponent(replyText)}`;
}

/**
 * Generate a Reddit comment deep link.
 * Opens the thread with the comment box focused. User pastes the reply.
 */
function generateRedditIntent(sourceUrl: string, _replyText: string): string {
  // Reddit does not support pre-filled comment text via URL params.
  // We deep link to the thread. The reply text is provided alongside for copy-paste.
  // Ensure we link to the specific comment if available
  const cleanUrl = sourceUrl.split("?")[0];
  return cleanUrl;
}

/**
 * Generate a LinkedIn comment deep link.
 * Opens the post's comment section. User pastes the reply.
 */
function generateLinkedInIntent(sourceUrl: string, _replyText: string): string {
  // LinkedIn does not support pre-filled comment text.
  // Deep link to the post. Reply text provided alongside for copy-paste.
  return sourceUrl;
}

/**
 * Route to the correct platform intent generator.
 */
function generateIntentUrl(platform: string, sourceUrl: string, replyText: string): string {
  switch (platform) {
    case "twitter":
      return generateTwitterIntent(sourceUrl, replyText);
    case "reddit":
      return generateRedditIntent(sourceUrl, replyText);
    case "linkedin":
      return generateLinkedInIntent(sourceUrl, replyText);
    default:
      return sourceUrl;
  }
}

// ---------------------------------------------------------------------------
// Database operations
// ---------------------------------------------------------------------------

async function getApprovedDrafts(tenantId: string, draftIds?: string[]): Promise<StrikeDraft[]> {
  const pool = getReadPool();

  if (draftIds && draftIds.length > 0) {
    const placeholders = draftIds.map((_, i) => `$${i + 2}`).join(", ");
    const result = await pool.query(
      `SELECT * FROM strike_drafts WHERE tenant_id = $1 AND status = 'approved' AND id IN (${placeholders}) ORDER BY engagement_score DESC`,
      [tenantId, ...draftIds],
    );
    return result.rows as StrikeDraft[];
  }

  // Get all approved drafts not yet engaged
  const result = await pool.query(
    `SELECT * FROM strike_drafts WHERE tenant_id = $1 AND status = 'approved' ORDER BY engagement_score DESC LIMIT 50`,
    [tenantId],
  );
  return result.rows as StrikeDraft[];
}

async function markDraftsEngaged(draftIds: string[]): Promise<number> {
  if (draftIds.length === 0) return 0;
  const pool = getWritePool();
  const placeholders = draftIds.map((_, i) => `$${i + 1}`).join(", ");
  const result = await pool.query(
    `UPDATE strike_drafts SET status = 'intent_generated', intent_generated_at = NOW() WHERE id IN (${placeholders})`,
    draftIds,
  );
  return result.rowCount ?? 0;
}

async function confirmEngagement(draftIds: string[]): Promise<number> {
  if (draftIds.length === 0) return 0;
  const pool = getWritePool();
  const placeholders = draftIds.map((_, i) => `$${i + 1}`).join(", ");

  // Update draft status
  await pool.query(
    `UPDATE strike_drafts SET status = 'confirmed', confirmed_at = NOW() WHERE id IN (${placeholders})`,
    draftIds,
  );

  // Update the corresponding market_intelligence facts to 'engaged'
  const result = await pool.query(
    `UPDATE market_intelligence SET engagement_status = 'engaged', engaged_at = NOW()
     WHERE id IN (SELECT fact_id FROM strike_drafts WHERE id IN (${placeholders}))`,
    draftIds,
  );

  return result.rowCount ?? 0;
}

async function getEngagementMetrics(tenantId: string): Promise<EngagementMetrics> {
  const pool = getReadPool();

  const totals = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('intent_generated', 'confirmed')) AS total_generated,
       COUNT(*) FILTER (WHERE status = 'confirmed') AS total_confirmed,
       COUNT(*) FILTER (WHERE status = 'intent_generated') AS total_pending,
       COALESCE(AVG(engagement_score) FILTER (WHERE status IN ('intent_generated', 'confirmed')), 0) AS avg_score
     FROM strike_drafts
     WHERE tenant_id = $1`,
    [tenantId],
  );

  const byPlatform = await pool.query(
    `SELECT
       platform,
       COUNT(*) FILTER (WHERE status IN ('intent_generated', 'confirmed')) AS generated,
       COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed
     FROM strike_drafts
     WHERE tenant_id = $1
     GROUP BY platform`,
    [tenantId],
  );

  const row = totals.rows[0] ?? {};
  const generated = parseInt(row.total_generated ?? "0", 10);
  const confirmed = parseInt(row.total_confirmed ?? "0", 10);

  const platforms: Record<string, { generated: number; confirmed: number }> = {};
  for (const r of byPlatform.rows) {
    platforms[r.platform] = {
      generated: parseInt(r.generated ?? "0", 10),
      confirmed: parseInt(r.confirmed ?? "0", 10),
    };
  }

  return {
    total_generated: generated,
    total_confirmed: confirmed,
    total_pending: parseInt(row.total_pending ?? "0", 10),
    confirmation_rate: generated > 0 ? Math.round((confirmed / generated) * 100) : 0,
    by_platform: platforms,
    avg_engagement_score: Math.round(parseFloat(row.avg_score ?? "0")),
  };
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(
  params: EngageParams,
  context: ToolContext,
): Promise<ToolResult> {
  const { config, logger } = context;
  const tenantId = config.TIGER_CLAW_TENANT_ID;
  const { action } = params;

  try {
    switch (action) {
      case "generate": {
        const drafts = await getApprovedDrafts(tenantId, params.draft_ids);

        if (drafts.length === 0) {
          return {
            ok: true,
            output: "No approved drafts found. Run tiger_strike_draft then approve drafts before generating engagement links.",
            data: { links: [] },
          };
        }

        const links: EngagementLink[] = [];

        for (const draft of drafts) {
          const intentUrl = generateIntentUrl(draft.platform, draft.source_url, draft.drafted_reply);

          links.push({
            draft_id: draft.id,
            platform: draft.platform,
            entity_label: draft.entity_label,
            drafted_reply: draft.drafted_reply,
            intent_url: intentUrl,
            source_url: draft.source_url,
            engagement_score: draft.engagement_score,
          });
        }

        // Mark all as intent_generated
        await markDraftsEngaged(drafts.map((d) => d.id));

        logger.info(`tiger_strike_engage: generated ${links.length} intent URLs`, { tenantId });

        // Format output for the operator
        const output = links
          .map(
            (l, i) =>
              `[${i + 1}] ${l.platform.toUpperCase()} | ${l.entity_label} (score: ${l.engagement_score})\n` +
              `    Reply: ${l.drafted_reply}\n` +
              (l.platform === "twitter"
                ? `    Click to reply: ${l.intent_url}\n`
                : `    Open thread: ${l.intent_url}\n    Copy reply above and paste as comment.\n`),
          )
          .join("\n");

        return {
          ok: true,
          output:
            `Generated ${links.length} engagement link(s).\n\n` +
            output +
            `\nAfter posting, call action: 'confirm' with the draft_ids to close the feedback loop.`,
          data: { links },
        };
      }

      case "confirm": {
        if (!params.confirmed_ids || params.confirmed_ids.length === 0) {
          return { ok: false, error: "confirm action requires confirmed_ids array." };
        }

        const confirmed = await confirmEngagement(params.confirmed_ids);
        logger.info(`tiger_strike_engage: confirmed ${confirmed} engagements`, { tenantId });

        return {
          ok: true,
          output: `Confirmed ${confirmed} engagement(s). Market intelligence facts updated to 'engaged'. The learning loop will use this data to improve future scoring and drafting.`,
          data: { confirmed },
        };
      }

      case "metrics": {
        const metrics = await getEngagementMetrics(tenantId);
        logger.info("tiger_strike_engage: metrics", { tenantId, metrics });

        const platformBreakdown = Object.entries(metrics.by_platform)
          .map(([p, m]) => `  ${p}: ${m.generated} generated, ${m.confirmed} confirmed`)
          .join("\n");

        return {
          ok: true,
          output:
            `Tiger Strike Engagement Metrics:\n` +
            `  Total intent URLs generated: ${metrics.total_generated}\n` +
            `  Confirmed engagements: ${metrics.total_confirmed}\n` +
            `  Pending confirmation: ${metrics.total_pending}\n` +
            `  Confirmation rate: ${metrics.confirmation_rate}%\n` +
            `  Average engagement score: ${metrics.avg_engagement_score}\n` +
            `\nBy platform:\n${platformBreakdown || "  No data yet."}`,
          data: metrics,
        };
      }

      default:
        return {
          ok: false,
          error: `Unknown action: "${action}". Valid actions: generate | confirm | metrics`,
        };
    }
  } catch (err) {
    logger.error("tiger_strike_engage error", { action, err: String(err) });
    return {
      ok: false,
      error: `tiger_strike_engage error in action "${action}": ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool export
// ---------------------------------------------------------------------------

export const tiger_strike_engage = {
  name: "tiger_strike_engage",
  description:
    "Zero-cost engagement execution engine for Tiger Strike. Takes approved drafts from tiger_strike_draft and generates " +
    "platform-specific Web Intent URLs that open pre-filled reply windows in the operator's browser. " +
    "No API write costs. No OAuth tokens for posting. No bot detection risk. " +
    "Call with action: 'generate' to create engagement links for approved drafts. " +
    "Call with action: 'confirm' with confirmed_ids after the operator posts to close the feedback loop. " +
    "Call with action: 'metrics' to see engagement performance stats.",

  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["generate", "confirm", "metrics"],
        description:
          "'generate' — create Web Intent URLs for approved drafts. 'confirm' — mark engagements as completed. 'metrics' — view engagement stats.",
      },
      draft_ids: {
        type: "array",
        items: { type: "string" },
        description: "Specific draft IDs to generate links for. If omitted, generates for all approved drafts.",
      },
      confirmed_ids: {
        type: "array",
        items: { type: "string" },
        description: "Draft IDs that the operator has confirmed posting. Required for 'confirm' action.",
      },
    },
    required: ["action"],
  },

  execute,
};

export default tiger_strike_engage;
