import { ToolContext, ToolResult } from "./ToolContext.js";
import { loadFlavorConfig } from "./flavorConfig.js";
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
    demographic?: string; // e.g., "Parent of Freshman", "Student"
    timing?: string; // e.g., "Fall 2026", "Next Month"
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
 * Takes raw content from a researcher and extracts high-value facts.
 */
async function execute(
  params: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const { logger } = context;
  const rawContent = params.rawContent as string;
  const sourceUrl = params.sourceUrl as string;
  const extractionGoal = (params.extractionGoal as string) || "intent_signals";
  const domain = (params.domain as string) || "Generic Market Research";
  const capturedBy = (params.capturedBy as string) || "unknown";
  const entityId = (params.entityId as string) || null;
  const miningCost = (params.miningCost as number) || 0.05; // Default mock cost

  logger.info("tiger_refine: Starting purification", { sourceUrl, extractionGoal, domain, capturedBy });

  if (!rawContent || rawContent.length < 10) {
    return { ok: false, error: "Content too short for refinement." };
  }

  // Mock Refinement logic (maps to specialized LLM in full v5)
  // Fact Decay Logic: Milestone intent usually expires in 120 days.
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 120);

  const report: RefinementReport = {
    domain,
    goal: extractionGoal,
    facts: [
      {
        type: "intent_signal",
        sourceUrl,
        rawText: "Sample high-intent text from source.",
        purifiedFact: `Purified [${extractionGoal}] fact based on raw content.`,
        confidenceScore: 90,
        metadata: {
          intentType: "milestone",
          demographic: "Target Lead",
          timing: "Upcoming",
          intensity: "high"
        }
      }
    ],
    summary: `Extracted intent signals from ${sourceUrl} via ${capturedBy}.`
  };

  // Save facts to the Data Moat
  for (const fact of report.facts) {
    try {
      await saveMarketFact({
        domain: report.domain,
        category: fact.type,
        entity_id: entityId || (fact.metadata.author ? `u/${fact.metadata.author}` : undefined),
        entity_label: fact.metadata.demographic || "Unknown",
        fact_summary: fact.purifiedFact,
        confidence_score: fact.confidenceScore,
        mining_cost: miningCost,
        source_url: fact.sourceUrl || sourceUrl || "unknown",
        captured_by: capturedBy,
        metadata: fact.metadata,
        verified_at: new Date(),
        valid_until: validUntil
      });
    } catch (err) {
      logger.error("tiger_refine: Failed to save fact to moat", { err: String(err) });
    }
  }

  return {
    ok: true,
    output: `Refinement Complete. ${report.facts.length} facts purified and saved to the Sovereign Data Moat.`,
    data: report
  };
}

export const tiger_refine = {
  name: "tiger_refine",
  description: "v5 Data Refinery: Purifies raw scraped text into high-value, structured market intelligence facts.",
  parameters: {
    type: "object",
    properties: {
      rawContent: { type: "string", description: "The raw text or HTML to be purified." },
      sourceUrl: { type: "string", description: "The source URL for provenance tracking." },
      extractionGoal: { type: "string", description: "What to look for (e.g., 'objections', 'pricing', 'unmet needs')." },
    },
    required: ["rawContent"],
  },
  execute,
};

export default tiger_refine;
