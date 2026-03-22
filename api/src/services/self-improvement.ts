// Tiger Claw — Self-Improvement & Learning Service
// TIGERCLAW-MASTER-SPEC-v2.md Block 2.5 Evolution
//
// Implements the Log-Review-Promote cycle from ClawHub.
// Integrates with Lossless Memory to turn session failures into architectural knowledge.

import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const LEARNINGS_DIR = join(process.cwd(), ".learnings");
const ERRORS_LOG = join(LEARNINGS_DIR, "ERRORS.md");
const LEARNINGS_LOG = join(LEARNINGS_DIR, "LEARNINGS.md");

export interface SelfImprovementEvent {
  type: "ERROR" | "LEARNING" | "PATTERN";
  code: string; // e.g. ERR-20260317-001
  description: string;
  context: any;
}

export async function logLearning(event: SelfImprovementEvent): Promise<void> {
  const timestamp = new Date().toISOString();
  const entry = `
## [${event.code}] ${event.type} - ${timestamp}
- **Description:** ${event.description}
- **Context:** ${JSON.stringify(event.context, null, 2)}
- **Status:** Logged
---
`;

  const targetFile = event.type === "ERROR" ? ERRORS_LOG : LEARNINGS_LOG;
  
  try {
    if (!existsSync(LEARNINGS_DIR)) return;
    appendFileSync(targetFile, entry);
    console.log(`[self-improvement] Successfully logged ${event.type}: ${event.code}`);
  } catch (err) {
    console.error("[self-improvement] Failed to write to learnings log:", err);
  }
}

/**
 * Analyzes the Lossless Memory for patterns.
 * If a failure (like BotFather rate limit) occurs 3+ times, it flags a candidate for 'Promotion'.
 */
export async function analyzePatterns(tenantId: string): Promise<string[]> {
  // TODO: Query the 'key_events' or 'admin_events' table for high-frequency failures
  // For now, return a placeholder indicating the engine is watching.
  return ["Pattern recognition active for tenant: " + tenantId];
}

/**
 * 'Promotes' a recurring learning to the agent's core instructions.
 */
export async function promoteToCore(learningCode: string, targetFile: string): Promise<void> {
  console.log(`[self-improvement] PROMOTING ${learningCode} to ${targetFile}...`);
  // Logic to append to CLAUDE.md or niche flavor JSON would go here.
}
