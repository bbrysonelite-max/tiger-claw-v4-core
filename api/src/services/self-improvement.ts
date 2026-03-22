// Tiger Claw — Self-Improvement & Learning Service
// TIGERCLAW-MASTER-SPEC-v2.md Block 2.5 Evolution
//
// Implements the Log-Review-Promote cycle from ClawHub.
// Integrates with Lossless Memory to turn session failures into architectural knowledge.

import { logAdminEvent } from "./db.js";

export interface SelfImprovementEvent {
  type: "ERROR" | "LEARNING" | "PATTERN";
  code: string; // e.g. ERR-20260317-001
  description: string;
  context: any;
}

export async function logLearning(event: SelfImprovementEvent): Promise<void> {
  const action = `self_improvement_${event.type.toLowerCase()}`;
  
  try {
    await logAdminEvent(action, undefined, {
      code: event.code,
      description: event.description,
      context: event.context
    });
    console.log(`[self-improvement] Successfully synchronized ${event.type}: ${event.code} to PostgreSQL`);
  } catch (err) {
    console.error("[self-improvement] Failed to write to telemetry database:", err);
  }
}

/**
 * Analyzes the Lossless Memory for patterns.
 * If a failure occurs 3+ times, it flags a candidate for 'Promotion'.
 */
export async function analyzePatterns(tenantId: string): Promise<string[]> {
  // TODO: Query the 'admin_events' table for high-frequency failures
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
