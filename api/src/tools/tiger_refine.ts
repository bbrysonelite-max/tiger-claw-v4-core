import { GoogleGenerativeAI } from "@google/generative-ai";
import { ToolContext, ToolResult } from "./ToolContext.js";
import { saveMarketFact } from "../services/market_intel.js";

// ---------------------------------------------------------------------------
// Types for High-Value Data
// ---------------------------------------------------------------------------

export interface RefinedFact {
  type: "objection" | "claim" | "sentiment" | "pricing" | "gap" | "intent_signal";
  sourceUrl?: string;
  rawText: string;
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
  summary: string;
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
  const extractionGoal = (params.extractionGoal as string) || "intent_signals";
  const domain = (params.domain as string) || "Generic Market Research";
  const capturedBy = (params.capturedBy as string) || "unknown";
  const entityId = (params.entityId as string) || null;
  const miningCost = (params.miningCost as number) || 0.05;

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
  "rawText": "the verbatim or near-verbatim quote from the content (max 200 chars)",
  "purifiedFact": "concise actionable insight in 1-2 sentences",
  "confidenceScore": number between 0 and 100,
  "metadata": {
    "category": "string describing the topic category",
    "intensity": "low" | "medium" | "high",
    "intentType": "purchase" | "research" | "frustration" | "milestone" (use whichever fits, or omit),
    "demographic": "who expressed this, if discernible from the content"
  }
}

Return an empty array [] if no meaningful facts are present. Do not invent facts not present in the content. Aim for 1-5 high-quality facts per piece of content.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        facts = parsed.filter(
          (f: any) =>
            f &&
            typeof f.purifiedFact === "string" &&
            typeof f.confidenceScore === "number"
        );
      }
    } catch (parseErr) {
      logger.error("[tiger_refine] Failed to parse Gemini JSON output", { parseErr: String(parseErr), raw: responseText.slice(0, 200) });
    }
  } catch (geminiErr) {
    logger.error("[tiger_refine] Gemini extraction failed", { err: String(geminiErr) });
    return { ok: false, error: `Gemini extraction failed: ${String(geminiErr)}` };
  }

  // Save facts to the Data Moat
  let saved = 0;
  for (const fact of facts) {
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
        metadata: { ...fact.metadata, rawText: fact.rawText },
        verified_at: new Date(),
        valid_until: validUntil,
      });
      saved++;
    } catch (err) {
      logger.error("[tiger_refine] Failed to save fact to moat", { err: String(err) });
    }
  }

  logger.info(`[tiger_refine] Purification complete: ${saved}/${facts.length} facts saved.`);

  const report: RefinementReport = {
    domain,
    goal: extractionGoal,
    facts,
    summary: `Extracted ${facts.length} facts from ${sourceUrl} via ${capturedBy}. ${saved} saved to moat.`,
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
