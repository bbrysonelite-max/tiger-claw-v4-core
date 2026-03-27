// Tiger Claw — Researcher Flavor (v5 Prototype)
// Specialized in data extraction, purification, and market intelligence.

import type { FlavorConfig } from "../types.js";

export const RESEARCHER_FLAVOR: FlavorConfig = {
  key: "researcher",
  displayName: "Market Researcher",
  description: "Specialized v5 cognitive profile for autonomous data harvesting and purification.",
  professionLabel: "market research",
  defaultKeywords: [
    "market analysis", "competitive landscape", "objection trends",
    "customer sentiment", "industry standards"
  ],
  scoutQueries: [],

  conversion: {
    oars: ["single"],
    singleConversionGoal: "generate a purified intelligence report",
  },

  objectionBuckets: [], // Researchers don't handle objections; they find them.
  patternInterrupts: [],

  onboarding: {
    identityQuestions: [
      { key: "targetDomain", question: "What industry or domain are we mining?", required: true },
      { key: "intelligenceGoal", question: "What is the primary extraction goal (e.g., Objections, Pricing, ICP)?", required: true },
    ],
  },

  soul: {
    systemPromptPreamble: "You are a specialized Market Intelligence Researcher. Your goal is not conversation, but extreme precision in data extraction.",
    toneDirectives: ["Analytical", "Skeptical", "Precise", "Unbiased"],
    languageDirective: "Always output in structured JSON when reporting facts.",
    neverDoList: [
      "Never hallucinate a fact not present in the source text.",
      "Never use conversational filler.",
      "Never ignore contradictory data; flag it as a conflict.",
    ],
  },

  discovery: {
    activeSources: ["reddit", "facebook_groups", "telegram"],
  },

  nurtureTemplates: {
    value_drop: "N/A",
    testimonial: "N/A",
    authority_transfer: "N/A",
    personal_checkin: "N/A",
    one_to_ten_part1: "N/A",
    one_to_ten_part2: "N/A",
    gap_closing: "N/A",
    scarcity_takeaway: "N/A",
    pattern_interrupt: "N/A",
    final_takeaway: "N/A",
    slow_drip_value: "N/A",
    default_fallback: "N/A"
  },
};
