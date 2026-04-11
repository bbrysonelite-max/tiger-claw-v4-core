import { GoogleGenerativeAI } from "@google/generative-ai";
import { ToolContext, ToolResult } from "./ToolContext.js";
import { saveMarketFact } from "../services/market_intel.js";
import { callGemini, sanitizeGeminiJSON } from "../services/geminiGateway.js";
import type { FlavorConfig } from "../config/types.js";

// Structured Ideal Prospect Profile — consumed by the new relevance gate.
// Sourced from a flavor's idealProspectProfile field when present.
type IdealProspectProfile = NonNullable<FlavorConfig['idealProspectProfile']>;

// ---------------------------------------------------------------------------
// Types for High-Value Data
// ---------------------------------------------------------------------------

export interface RefinedFact {
  type: "objection" | "claim" | "sentiment" | "pricing" | "gap" | "intent_signal";
  sourceUrl?: string;
  verbatim: string;
  purifiedFact: string;
  confidenceScore: number; // 0-100
  metadata: {
    category?: string;
    intensity?: "low" | "medium" | "high";
    intentType?: "purchase" | "research" | "frustration" | "milestone";
    demographic?: string;
    timing?: string;
    [key: string]: any;
  };
}

export interface RefinementReport {
  domain: string;
  goal: string;
  facts: RefinedFact[];
  rejectedCount: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// IPP Relevance Gate (new, fail-closed)
//
// Runs when a flavor provides a structured idealProspectProfile. Classifies
// each extracted fact against the IPP's traits + disqualifiers + reject
// examples. Returns per-fact { keep, score, reason }. Attaches relevance_score
// and relevance_reason to metadata for every kept fact so downstream Strike
// draft queries can filter on relevance, not just extractor confidence.
//
// FAIL-CLOSED: if the gate errors (quota, network, parse), ALL facts in this
// batch are rejected and the error is logged loudly. The legacy gate's
// fail-open behavior is a silent-pollution bug we are explicitly NOT
// replicating here — better to lose a batch of facts than pollute the mine.
// ---------------------------------------------------------------------------
export async function runIPPGate(
  apiKey: string,
  domain: string,
  profile: IdealProspectProfile,
  facts: RefinedFact[],
  logger: ToolContext['logger'],
): Promise<{ kept: RefinedFact[]; rejected: number }> {
  const traitsText = profile.traits
    .map((t, i) => {
      const langLine = t.language.length > 0
        ? `\n   Prospect language: ${t.language.map(l => `"${l}"`).join(", ")}`
        : `\n   (detected by absence of hype language, not specific phrases)`;
      return `${i + 1}. ${t.name} — ${t.description}${langLine}`;
    })
    .join("\n\n");

  const disqualifiersText = profile.disqualifiers
    .map((d, i) => `${i + 1}. ${d.name} — ${d.signal}`)
    .join("\n");

  const rejectExamplesText = profile.rejectExamples
    .map(e => `- ${e}`)
    .join("\n");

  const factList = facts.map((f, i) => `${i}. ${f.purifiedFact}`).join("\n");

  const gatePrompt = `You are a ruthless relevance classifier for a "${domain}" lead-generation mine.
Your job: decide whether each extracted fact is evidence of an ideal prospect per the profile below.

IDEAL PROSPECT — ${profile.summary}

POSITIVE TRAITS (need at least ONE clearly present to KEEP a fact):

${traitsText}

DISQUALIFIERS (REJECT the fact if ANY are clearly present):

${disqualifiersText}

CRITICAL FILTER: A fact that is a real quote from a real person but has ZERO evidence
of ANY trait above is NOT relevant, even if it sounds financial or commercial.
Examples of facts that MUST be rejected:
${rejectExamplesText}

Facts to classify:
${factList}

Return JSON in this exact shape, one entry per index:
{
  "0": { "keep": true, "score": 85, "reason": "clear burnout + career-change seeking" },
  "1": { "keep": false, "score": 10, "reason": "job listing, no prospect in content" }
}

Scoring guidance:
- 80-100: clear, strong signal (A-tier)
- 60-79: moderate signal (B-tier)
- 40-59: borderline — keep=false unless multiple traits present
- 0-39: reject

Strictness: 9/10. When in doubt, REJECT. It is better to lose a borderline fact
than pollute the mine with one.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const gateModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const gateResult = await callGemini(() => gateModel.generateContent(gatePrompt));
    const gateResponse = gateResult.response.text();
    const classification = JSON.parse(sanitizeGeminiJSON(gateResponse));

    if (!classification || typeof classification !== 'object') {
      throw new Error(`Gate returned non-object response: ${gateResponse.slice(0, 200)}`);
    }

    const kept: RefinedFact[] = [];
    for (let i = 0; i < facts.length; i++) {
      const entry = classification[String(i)];
      if (!entry || typeof entry !== 'object') continue;
      if (entry.keep !== true) continue;
      const score = typeof entry.score === 'number' ? entry.score : 0;
      const reason = typeof entry.reason === 'string' ? entry.reason : '';
      const fact = facts[i]!;
      kept.push({
        ...fact,
        metadata: {
          ...fact.metadata,
          relevance_score: score,
          relevance_reason: reason,
        },
      });
    }

    const rejected = facts.length - kept.length;
    logger.info(`[tiger_refine] IPP gate classified ${facts.length} facts for "${domain}": kept=${kept.length}, rejected=${rejected}`);
    return { kept, rejected };
  } catch (gateErr) {
    // FAIL-CLOSED. Do not pollute the mine on gate failure. Loud log, reject all.
    logger.error(
      `[tiger_refine] IPP RELEVANCE GATE FAILED — rejecting all ${facts.length} facts (fail-closed). domain="${domain}" err=${String(gateErr)}`,
    );
    return { kept: [], rejected: facts.length };
  }
}

/**
 * tiger_refine: The v5 Purification Tool.
 * Takes raw content and extracts high-value structured market intelligence facts
 * using Gemini 2.0 Flash. Saves results to the sovereign data moat.
 */
async function execute(
  params: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const { logger } = context;
  const rawContent = params.rawContent as string;
  const sourceUrl = (params.sourceUrl as string) || "unknown";
  // Sanitize caller-controlled fields before injecting into Gemini prompt
  const extractionGoal = String((params.extractionGoal as string) || "intent_signals").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 200);
  const domain = String((params.domain as string) || "Generic Market Research").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 200);
  const capturedBy = (params.capturedBy as string) || "unknown";
  const entityId = (params.entityId as string) || null;
  const miningCost = (params.miningCost as number) || 0.05;
  // Optional structured IPP. When present, the new per-flavor relevance gate runs.
  // When absent, the legacy generic commercial-relevance gate runs (unchanged behavior).
  const prospectProfile = params.prospectProfile as IdealProspectProfile | undefined;

  logger.info("[tiger_refine] Starting purification", { sourceUrl, extractionGoal, domain, capturedBy });

  if (!rawContent || rawContent.length < 10) {
    return { ok: false, error: "Content too short for refinement." };
  }

  const apiKey = process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    return { ok: false, error: "No GOOGLE_API_KEY available for refinement." };
  }

  // Fact decay: market intelligence expires in 120 days
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 120);

  let facts: RefinedFact[] = [];

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `You are a market intelligence extraction engine for a sales AI platform.

Domain: "${domain}"
Extraction goal: "${extractionGoal}"

Analyze the following content and extract high-value market intelligence facts.
Focus on: buying signals, objections, pain points, unmet needs, competitor mentions, pricing sensitivity, and purchase intent.

Content:
---
${rawContent.slice(0, 8000)}
---

Return a JSON array of facts. Each fact must have exactly these fields:
{
  "type": "objection" | "claim" | "sentiment" | "pricing" | "gap" | "intent_signal",
  "verbatim": "EXACT word-for-word text copied from the content above — must be characters that appear literally in the source, no paraphrasing, no summarizing, max 300 chars",
  "purifiedFact": "concise actionable insight in 1-2 sentences",
  "confidenceScore": number between 0 and 100,
  "metadata": {
    "category": "string describing the topic category",
    "intensity": "low" | "medium" | "high",
    "intentType": "purchase" | "research" | "frustration" | "milestone" (use whichever fits, or omit),
    "demographic": "who expressed this, if discernible from the content"
  }
}

CRITICAL RULE: The "verbatim" field is REQUIRED. If you cannot find an exact quote from the content that proves the fact, do NOT include that fact. Return an empty array [] if no facts have supporting direct quotes.
Return an empty array [] if no meaningful facts are present. Do not invent facts not present in the content. Aim for 1-5 high-quality facts per piece of content.`;

    const result = await callGemini(() => model.generateContent(prompt));
    const responseText = result.response.text();

    try {
      const parsed = JSON.parse(sanitizeGeminiJSON(responseText));
      if (Array.isArray(parsed)) {
        facts = parsed.filter(
          (f: any) =>
            f &&
            typeof f.purifiedFact === "string" &&
            typeof f.confidenceScore === "number" &&
            typeof f.verbatim === "string" &&
            f.verbatim.trim().length >= 15
        );
      }
    } catch (parseErr) {
      logger.error("[tiger_refine] Failed to parse Gemini JSON output", { parseErr: String(parseErr), raw: responseText.slice(0, 200) });
    }
  } catch (geminiErr) {
    logger.error("[tiger_refine] Gemini extraction failed", { err: String(geminiErr) });
    return { ok: false, error: `Gemini extraction failed: ${String(geminiErr)}` };
  }

  // Relevance Gate — two paths:
  //   1. IPP gate (new, fail-closed): runs when the flavor supplies an idealProspectProfile.
  //      Classifies each fact against structured traits + disqualifiers. Attaches
  //      relevance_score and relevance_reason to metadata. Failures reject all facts loudly.
  //   2. Legacy commercial-relevance gate (unchanged, fail-open): runs when no profile is
  //      supplied. Preserves original behavior for flavors that haven't migrated yet.
  let finalFacts: RefinedFact[] = [];
  let rejectedCount = 0;

  if (facts.length > 0) {
    if (prospectProfile) {
      // Pre-filter: reject facts whose source URL matches any blocklist pattern.
      // Applied BEFORE the gate runs so no Gemini quota is burned on known-bad sources.
      // Catches affiliate/review/marketing content that the extractor paraphrases
      // into prospect-sounding language.
      const blocklist = prospectProfile.sourceUrlBlocklist ?? [];
      const effectiveSourceUrl = sourceUrl;
      const isBlocked = blocklist.length > 0 && blocklist.some(pat => effectiveSourceUrl.includes(pat));
      if (isBlocked) {
        logger.info(`[tiger_refine] Source URL blocklisted — pre-rejecting ${facts.length} facts from ${effectiveSourceUrl}`);
        finalFacts = [];
        rejectedCount = facts.length;
      } else {
        const gateOutcome = await runIPPGate(apiKey, domain, prospectProfile, facts, logger);
        finalFacts = gateOutcome.kept;
        rejectedCount = gateOutcome.rejected;
      }
    } else {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const gateModel = genAI.getGenerativeModel({
          model: "gemini-2.0-flash",
          generationConfig: { responseMimeType: "application/json" },
        });

        const gatePrompt = `You are a RUTHLESS commercial relevance gate for a market intelligence engine.
Domain: "${domain}"

Your job is to filter out any facts that are not directly relevant to a REAL-WORLD professional working in the "${domain}" industry.

CRITICAL RULE: If the fact is about a VIDEO GAME, BOARD GAME, MOVIE, BOOK, or FICTIONAL UNIVERSE, you MUST return FALSE. Even if terms like "health", "stats", "plumbing", or "design" are used, if they refer to game mechanics or lore, they are 100% IRRELEVANT.

REJECT (false) — only clear non-commercial content:
- Video games, board games, movies, books, fictional universes, RPG/game mechanics, lore.
- Pure social chitchat with zero business signal.

ACCEPT (true) — any of the following:
- Real-world purchase intent, research behavior, or product interest from real people.
- Business pain points, income concerns, career or financial anxiety.
- Competitor mentions, pricing sensitivity, or cost objections.
- Industry-specific professional challenges or unmet needs.
- General frustration or aspiration that a professional in "${domain}" could act on.

Facts to classify:
${facts.map((f, i) => `${i}. ${f.purifiedFact}`).join("\n")}

Return a JSON object mapping each index to a boolean representing its relevance.
Strictness: 6/10. Accept any fact with a plausible commercial signal. Only reject obvious non-business content.
Example: {"0": true, "1": false}`;

        const gateResult = await callGemini(() => gateModel.generateContent(gatePrompt));
        const gateResponse = gateResult.response.text();
        const classification = JSON.parse(gateResponse);
        logger.info(`[tiger_refine] Gate classification results for "${domain}":`, classification);

        finalFacts = facts.filter((_, i) => classification[String(i)] === true);
        rejectedCount = facts.length - finalFacts.length;

        if (rejectedCount > 0) {
          logger.info(`[tiger_refine] Relevance gate rejected ${rejectedCount}/${facts.length} facts for domain "${domain}".`);
        }
      } catch (gateErr) {
        logger.error("[tiger_refine] Relevance gate failed, falling back to all facts", { err: String(gateErr) });
        finalFacts = facts;
      }
    }
  }

  // Save facts to the Data Moat
  let saved = 0;
  for (const fact of finalFacts) {
    try {
      await saveMarketFact({
        domain,
        category: fact.type,
        entity_id: entityId || undefined,
        entity_label: fact.metadata?.demographic || "Unknown",
        fact_summary: fact.purifiedFact,
        confidence_score: fact.confidenceScore,
        mining_cost: miningCost,
        source_url: fact.sourceUrl || sourceUrl,
        captured_by: capturedBy,
        metadata: { ...fact.metadata, verbatim: fact.verbatim },
        verified_at: new Date(),
        valid_until: validUntil,
      });
      saved++;
    } catch (err) {
      logger.error("[tiger_refine] Failed to save fact to moat", { err: String(err) });
    }
  }

  logger.info(`[tiger_refine] Purification complete: ${saved}/${facts.length} facts saved. (${rejectedCount} rejected by gate)`);

  const report: RefinementReport = {
    domain,
    goal: extractionGoal,
    facts: finalFacts,
    rejectedCount,
    summary: `Extracted ${facts.length} facts. ${rejectedCount} rejected by relevance gate. ${saved} saved to moat.`,
  };

  return {
    ok: true,
    output: `Refinement Complete. ${saved} facts purified and saved to the Sovereign Data Moat.`,
    data: report,
  };
}

export const tiger_refine = {
  name: "tiger_refine",
  description:
    "v5 Data Refinery: Purifies raw scraped text into high-value, structured market intelligence facts using Gemini.",
  parameters: {
    type: "object",
    properties: {
      rawContent: { type: "string", description: "The raw text or HTML to be purified." },
      sourceUrl: { type: "string", description: "The source URL for provenance tracking." },
      extractionGoal: {
        type: "string",
        description: "What to look for (e.g., 'objections', 'pricing', 'unmet needs').",
      },
    },
    required: ["rawContent"],
  },
  execute,
};

export default tiger_refine;
