// Tiger Strike — tiger_strike_draft Tool
// Engagement Layer: Phase 2 of the Sabbertooth Assimilation
//
// What this tool does:
//   1. Takes a batch of market_intelligence facts (from tiger_strike_harvest)
//   2. Loads the tenant's voice profile from onboard_state + fact_anchors
//   3. Calls Gemini to generate a contextual, human-sounding reply for each fact
//   4. Stores drafts in the strike_drafts table with status "pending_review"
//   5. Returns drafts ready for tiger_strike_engage to generate Web Intent URLs
//
// The drafting engine uses a two-pass approach:
//   Pass 1: Score the fact for engagement worthiness (is this person worth replying to?)
//   Pass 2: Draft the reply in the tenant's voice, referencing the source context
//
// Stateless: All state lives in PostgreSQL. No Redis, no local files.

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as crypto from "crypto";
import { getReadPool, getWritePool } from "../services/db.js";
import { getTenantState } from "../services/tenant_data.js";
import { loadFlavorConfig } from "./flavorConfig.js";
import type { ToolContext, ToolResult } from "./ToolContext.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftParams {
  action: "draft" | "list" | "approve" | "reject" | "edit";
  facts?: MarketFact[];
  draft_ids?: string[];
  edited_text?: string;
  tone?: string;
}

interface MarketFact {
  id: string;
  domain: string;
  category: string;
  entity_label: string;
  fact_summary: string;
  source_url: string;
  confidence_score: number;
}

interface VoiceProfile {
  name: string;
  productOrOpportunity: string;
  yearsInProfession: string;
  tone: string[];
  neverSay: string[];
  biggestWin?: string;
  personalStory?: string;
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
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENGAGEMENT_THRESHOLD = 60;
const MAX_REPLY_LENGTH = 280;
const MAX_DRAFTS_PER_BATCH = 20;

// ---------------------------------------------------------------------------
// Voice profile loader
// ---------------------------------------------------------------------------

async function loadVoiceProfile(tenantId: string, flavor: string): Promise<VoiceProfile> {
  const onboardState = await getTenantState(tenantId, "onboard_state.json") as any;
  const factAnchors = await getTenantState(tenantId, "fact_anchors") as any;
  const flavorConfig = loadFlavorConfig(flavor);

  const identity = onboardState?.identity ?? {};
  const preferences = factAnchors?.preferencesStated ?? [];

  return {
    name: identity.name ?? "the operator",
    productOrOpportunity: identity.productOrOpportunity ?? flavorConfig.professionLabel,
    yearsInProfession: identity.yearsInProfession ?? "several",
    tone: flavorConfig.nurtureTemplates
      ? ["warm", "direct", "helpful"]
      : ["professional", "concise"],
    neverSay: [
      "I'm an AI",
      "As an AI",
      "I don't have personal experience",
      "DM me",
      "Check out my link",
    ],
    biggestWin: preferences.length > 0 ? preferences[0].value : undefined,
    personalStory: factAnchors?.icpUpdates?.[0]?.value,
  };
}

// ---------------------------------------------------------------------------
// Platform detection from source URL
// ---------------------------------------------------------------------------

function detectPlatform(sourceUrl: string): string {
  if (sourceUrl.includes("reddit.com")) return "reddit";
  if (sourceUrl.includes("twitter.com") || sourceUrl.includes("x.com")) return "twitter";
  if (sourceUrl.includes("linkedin.com")) return "linkedin";
  if (sourceUrl.includes("instagram.com")) return "instagram";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Pass 1: Engagement scoring
// ---------------------------------------------------------------------------

async function scoreEngagement(
  fact: MarketFact,
  apiKey: string,
): Promise<{ score: number; reason: string }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt =
    `You are a lead qualification expert. Score this social media post for engagement worthiness on a scale of 0-100.\n\n` +
    `Post context:\n` +
    `- Category: ${fact.category}\n` +
    `- Person: ${fact.entity_label}\n` +
    `- Content: ${fact.fact_summary}\n` +
    `- Source: ${fact.source_url}\n\n` +
    `Score based on:\n` +
    `- Is this person expressing a genuine need or pain point? (40%)\n` +
    `- Is this person likely a decision-maker or buyer? (30%)\n` +
    `- Is the timing right for engagement? (20%)\n` +
    `- Is the platform appropriate for a reply? (10%)\n\n` +
    `Output ONLY valid JSON: { "score": <number>, "reason": "<one sentence>" }`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text?.() ?? "";
  const jsonStr = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(jsonStr);
  } catch {
    return { score: 50, reason: "Unable to parse engagement score — defaulting to neutral." };
  }
}

// ---------------------------------------------------------------------------
// Pass 2: Reply drafting
// ---------------------------------------------------------------------------

async function draftReply(
  fact: MarketFact,
  voice: VoiceProfile,
  platform: string,
  tone: string,
  apiKey: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const platformGuidance: Record<string, string> = {
    reddit: "Write as a genuine Reddit comment. No self-promotion. Add value first. Use casual but intelligent tone. Reference the specific situation they described.",
    twitter: `Write a reply tweet under ${MAX_REPLY_LENGTH} characters. Be concise, insightful, and conversational. No hashtags. No links.`,
    linkedin: "Write a professional LinkedIn comment. Add genuine insight or a relevant personal experience. Keep it under 3 sentences.",
    instagram: "Write a brief, authentic Instagram comment. Keep it under 2 sentences. Be supportive and genuine.",
    unknown: "Write a brief, helpful reply. Be genuine and add value.",
  };

  const prompt =
    `You are ${voice.name}, a ${voice.productOrOpportunity} professional with ${voice.yearsInProfession} years of experience.\n\n` +
    `Your tone is: ${tone || voice.tone.join(", ")}.\n` +
    `NEVER say: ${voice.neverSay.join(", ")}.\n` +
    (voice.biggestWin ? `Your biggest win: ${voice.biggestWin}\n` : "") +
    `\nYou are replying to this post on ${platform}:\n` +
    `Person: ${fact.entity_label}\n` +
    `What they said: ${fact.fact_summary}\n\n` +
    `Platform rules: ${platformGuidance[platform] ?? platformGuidance.unknown}\n\n` +
    `CRITICAL RULES:\n` +
    `1. You are a REAL PERSON, not a bot. Write like a human who genuinely wants to help.\n` +
    `2. Reference their specific situation — do NOT give generic advice.\n` +
    `3. Do NOT pitch, sell, or link to anything. Just be helpful.\n` +
    `4. One reply only. No follow-up questions fishing for a DM.\n` +
    `5. If you have relevant personal experience, share it briefly.\n\n` +
    `Output ONLY the reply text. No quotes, no labels, no explanation.`;

  const result = await model.generateContent(prompt);
  let reply = result.response.text?.() ?? "";

  // Enforce platform length limits
  if (platform === "twitter" && reply.length > MAX_REPLY_LENGTH) {
    reply = reply.substring(0, MAX_REPLY_LENGTH - 3) + "...";
  }

  return reply.trim();
}

// ---------------------------------------------------------------------------
// Database: Store drafts
// ---------------------------------------------------------------------------

async function storeDraft(draft: Omit<StrikeDraft, "created_at">): Promise<void> {
  const pool = getWritePool();
  await pool.query(
    `INSERT INTO strike_drafts (id, fact_id, tenant_id, platform, source_url, entity_label, fact_summary, drafted_reply, engagement_score, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET drafted_reply = $8, engagement_score = $9, status = $10`,
    [draft.id, draft.fact_id, draft.tenant_id, draft.platform, draft.source_url, draft.entity_label, draft.fact_summary, draft.drafted_reply, draft.engagement_score, draft.status],
  );
}

async function listDrafts(tenantId: string, status?: string): Promise<StrikeDraft[]> {
  const pool = getReadPool();
  const params: string[] = [tenantId];
  let statusClause = "";
  if (status) {
    statusClause = " AND status = $2";
    params.push(status);
  }
  const result = await pool.query(
    `SELECT * FROM strike_drafts WHERE tenant_id = $1 ${statusClause} ORDER BY engagement_score DESC, created_at DESC LIMIT 50`,
    params,
  );
  return result.rows as StrikeDraft[];
}

async function updateDraftStatus(draftIds: string[], status: string): Promise<number> {
  if (draftIds.length === 0) return 0;
  const pool = getWritePool();
  const placeholders = draftIds.map((_, i) => `$${i + 2}`).join(", ");
  const result = await pool.query(
    `UPDATE strike_drafts SET status = $1 WHERE id IN (${placeholders})`,
    [status, ...draftIds],
  );
  return result.rowCount ?? 0;
}

async function editDraft(draftId: string, newText: string): Promise<boolean> {
  const pool = getWritePool();
  const result = await pool.query(
    `UPDATE strike_drafts SET drafted_reply = $1, status = 'approved' WHERE id = $2`,
    [newText, draftId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

async function execute(
  params: DraftParams,
  context: ToolContext,
): Promise<ToolResult> {
  const { config, logger } = context;
  const tenantId = config.TIGER_CLAW_TENANT_ID;
  const flavor = config.BOT_FLAVOR;
  const { action } = params;

  const apiKey = process.env.PLATFORM_ONBOARDING_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "No API key available for LLM calls." };
  }

  try {
    switch (action) {
      case "draft": {
        if (!params.facts || params.facts.length === 0) {
          return { ok: false, error: "draft action requires a facts array from tiger_strike_harvest." };
        }

        const facts = params.facts.slice(0, MAX_DRAFTS_PER_BATCH);
        const voice = await loadVoiceProfile(tenantId, flavor);
        const drafts: StrikeDraft[] = [];
        const skipped: string[] = [];

        for (const fact of facts) {
          // Pass 1: Score engagement worthiness
          const { score, reason } = await scoreEngagement(fact, apiKey);

          if (score < ENGAGEMENT_THRESHOLD) {
            skipped.push(`${fact.entity_label}: ${reason} (score: ${score})`);
            continue;
          }

          // Pass 2: Draft the reply
          const platform = detectPlatform(fact.source_url);
          const reply = await draftReply(fact, voice, platform, params.tone ?? "", apiKey);

          const draft: StrikeDraft = {
            id: crypto.randomUUID(),
            fact_id: fact.id,
            tenant_id: tenantId,
            platform,
            source_url: fact.source_url,
            entity_label: fact.entity_label,
            fact_summary: fact.fact_summary,
            drafted_reply: reply,
            engagement_score: score,
            status: "pending_review",
            created_at: new Date().toISOString(),
          };

          await storeDraft(draft);
          drafts.push(draft);
        }

        logger.info(`tiger_strike_draft: drafted ${drafts.length}, skipped ${skipped.length}`, { tenantId });

        return {
          ok: true,
          output:
            `Drafted ${drafts.length} replies. Skipped ${skipped.length} low-engagement facts.\n` +
            (skipped.length > 0 ? `\nSkipped:\n${skipped.map((s) => `  - ${s}`).join("\n")}` : "") +
            `\n\nDrafts are pending review. Use action: 'list' to see them, then 'approve' or 'reject'. Approved drafts can be sent via tiger_strike_engage.`,
          data: { drafts, skipped_count: skipped.length },
        };
      }

      case "list": {
        const drafts = await listDrafts(tenantId, "pending_review");
        return {
          ok: true,
          output:
            drafts.length === 0
              ? "No pending drafts. Run tiger_strike_harvest then tiger_strike_draft to generate new ones."
              : `${drafts.length} pending draft(s):\n\n` +
                drafts
                  .map(
                    (d, i) =>
                      `[${i + 1}] ${d.platform} | ${d.entity_label} (score: ${d.engagement_score})\n` +
                      `    Fact: ${d.fact_summary}\n` +
                      `    Draft: ${d.drafted_reply}\n` +
                      `    ID: ${d.id}`,
                  )
                  .join("\n\n"),
          data: { drafts },
        };
      }

      case "approve": {
        if (!params.draft_ids || params.draft_ids.length === 0) {
          return { ok: false, error: "approve action requires draft_ids array." };
        }
        const approved = await updateDraftStatus(params.draft_ids, "approved");
        return {
          ok: true,
          output: `Approved ${approved} draft(s). They are now ready for tiger_strike_engage.`,
          data: { approved },
        };
      }

      case "reject": {
        if (!params.draft_ids || params.draft_ids.length === 0) {
          return { ok: false, error: "reject action requires draft_ids array." };
        }
        const rejected = await updateDraftStatus(params.draft_ids, "rejected");
        return {
          ok: true,
          output: `Rejected ${rejected} draft(s). They will not be sent.`,
          data: { rejected },
        };
      }

      case "edit": {
        if (!params.draft_ids || params.draft_ids.length !== 1) {
          return { ok: false, error: "edit action requires exactly one draft_id." };
        }
        if (!params.edited_text) {
          return { ok: false, error: "edit action requires edited_text." };
        }
        const success = await editDraft(params.draft_ids[0], params.edited_text);
        return {
          ok: success,
          output: success
            ? "Draft updated and auto-approved. Ready for tiger_strike_engage."
            : "Draft not found.",
        };
      }

      default:
        return {
          ok: false,
          error: `Unknown action: "${action}". Valid actions: draft | list | approve | reject | edit`,
        };
    }
  } catch (err) {
    logger.error("tiger_strike_draft error", { action, err: String(err) });
    return {
      ok: false,
      error: `tiger_strike_draft error in action "${action}": ${String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool export
// ---------------------------------------------------------------------------

export const tiger_strike_draft = {
  name: "tiger_strike_draft",
  description:
    "AI reply drafting engine for Tiger Strike. Takes facts from tiger_strike_harvest, scores each for engagement worthiness, " +
    "and drafts contextual, human-sounding replies in the tenant's voice. " +
    "Call with action: 'draft' and pass the facts array. " +
    "Call with action: 'list' to see pending drafts. " +
    "Call with action: 'approve' or 'reject' with draft_ids. " +
    "Call with action: 'edit' with one draft_id and edited_text. " +
    "Approved drafts are sent to tiger_strike_engage for Web Intent URL generation.",

  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["draft", "list", "approve", "reject", "edit"],
        description:
          "'draft' — generate replies for facts. 'list' — show pending drafts. 'approve'/'reject' — update draft status. 'edit' — modify draft text.",
      },
      facts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            domain: { type: "string" },
            category: { type: "string" },
            entity_label: { type: "string" },
            fact_summary: { type: "string" },
            source_url: { type: "string" },
            confidence_score: { type: "number" },
          },
        },
        description: "Array of market_intelligence facts from tiger_strike_harvest. Required for 'draft' action.",
      },
      draft_ids: {
        type: "array",
        items: { type: "string" },
        description: "Array of draft IDs for approve/reject/edit actions.",
      },
      edited_text: {
        type: "string",
        description: "Replacement reply text for the edit action.",
      },
      tone: {
        type: "string",
        description: "Optional tone override (e.g., 'casual', 'professional', 'empathetic'). Defaults to tenant voice profile.",
      },
    },
    required: ["action"],
  },

  execute,
};

export default tiger_strike_draft;
