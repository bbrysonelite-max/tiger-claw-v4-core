// Tiger Claw — Self-Improvement & Learning Service
// TIGERCLAW-MASTER-SPEC-v2.md Block 2.5 Evolution + FITFO Protocol
//
// FITFO Failure Rule: ONE failure is a signal. Act on it immediately.
// — Log it with full context
// — Draft a skill that would have handled it
// — Submit it for review so the platform gets smarter
//
// The Growth Rule: What you learn by being persistent, you use to improve
// yourself for future tasks. Log it. Draft it. Promote it.

import { getPool, logAdminEvent } from "./db.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolFailureContext {
    tenantId: string;
    toolName: string;
    args: Record<string, any>;
    error: string;
    /** ISO timestamp of the failure */
    failedAt?: string;
}

export interface SkillDraft {
    id: string;
    name: string;
    description: string;
    type: 'prompt';
    scope: 'tenant';
    tenant_id: string;
    flavor: string | null;
    status: 'draft';
    implementation: { system: string };
    trigger_tool: string;
    trigger_args: Record<string, any>;
    trigger_error: string;
    created_by: 'agent';
    created_at: string;
}

// ─── Core: draft a skill from a single failure ────────────────────────────────

/**
 * FITFO Failure Rule implementation.
 *
 * Called immediately when a tool returns ok:false or throws. Drafts a prompt
 * skill that captures the failure context and suggests a recovery strategy,
 * then persists it to the skills table for admin curation.
 *
 * One failure = one draft. No threshold. No waiting.
 */
export async function draftSkillFromFailure(ctx: ToolFailureContext): Promise<SkillDraft | null> {
    const { tenantId, toolName, args, error } = ctx;
    const failedAt = ctx.failedAt ?? new Date().toISOString();

    const skillName = `recover_${toolName}_failure`;
    const description = `Auto-drafted: ${toolName} failed with "${error.slice(0, 120)}". Captures recovery strategy.`;

    // Build a prompt skill that injects recovery guidance into the system prompt
    // for this specific tool/error combination.
    const systemInstruction = [
        `SKILL — ${toolName.toUpperCase()} RECOVERY:`,
        `The tool ${toolName} previously failed with this error: "${error}"`,
        `When you call ${toolName} and receive this error again, do NOT retry immediately.`,
        `Instead:`,
        `1. Tell the operator calmly that you encountered a temporary issue.`,
        `2. Try an alternative approach or different parameters.`,
        `3. If the error persists, log it with tiger_keys(action="report_error") and move on.`,
        `4. Never let a single tool failure stop the overall workflow.`,
        `Original failure args: ${JSON.stringify(args).slice(0, 300)}`,
    ].join('\n');

    const pool = getPool();

    try {
        const result = await pool.query<{ id: string; created_at: string }>(
            `INSERT INTO skills
                (name, description, type, scope, tenant_id, status,
                 implementation, trigger_tool, trigger_args, trigger_error, created_by)
             VALUES ($1, $2, 'prompt', 'tenant', $3, 'draft',
                     $4::jsonb, $5, $6::jsonb, $7, 'agent')
             ON CONFLICT DO NOTHING
             RETURNING id, created_at`,
            [
                skillName,
                description,
                tenantId,
                JSON.stringify({ system: systemInstruction }),
                toolName,
                JSON.stringify(args),
                error,
            ],
        );

        if (result.rows.length === 0) {
            // Skill already exists for this tenant+name — skip silently
            console.log(`[self-improvement] Skill '${skillName}' already drafted for tenant ${tenantId} — skipping.`);
            return null;
        }

        const { id, created_at } = result.rows[0];

        // Also emit to admin_events so the curation dashboard can surface it
        await logAdminEvent('skill_auto_drafted', tenantId, {
            skill_id: id,
            skill_name: skillName,
            trigger_tool: toolName,
            trigger_error: error,
            failed_at: failedAt,
        }).catch(err => console.error('[self-improvement] Failed to log admin event:', err.message));

        console.log(`[self-improvement] Drafted skill '${skillName}' (id=${id}) for tenant ${tenantId}.`);

        return {
            id,
            name: skillName,
            description,
            type: 'prompt',
            scope: 'tenant',
            tenant_id: tenantId,
            flavor: null,
            status: 'draft',
            implementation: { system: systemInstruction },
            trigger_tool: toolName,
            trigger_args: args,
            trigger_error: error,
            created_by: 'agent',
            created_at,
        };
    } catch (err: any) {
        // If skills table doesn't exist yet (pre-migration), log loudly but don't crash
        console.error(`[self-improvement] [ALERT] Failed to draft skill for tenant ${tenantId} / tool ${toolName}:`, err.message);
        return null;
    }
}

// ─── Load approved skills for a tenant/flavor conversation ───────────────────

/**
 * Returns all approved (or platform-level) prompt skills for this tenant.
 * Called by buildSystemPrompt to inject dynamic skills into the context.
 */
export async function loadApprovedSkills(tenantId: string, flavor?: string): Promise<string[]> {
    const pool = getPool();
    try {
        const result = await pool.query<{ implementation: { system: string } }>(
            `SELECT implementation FROM skills
             WHERE type = 'prompt'
               AND status IN ('approved', 'platform')
               AND (
                   (scope = 'tenant' AND tenant_id = $1)
                   OR (scope = 'flavor' AND flavor = $2)
                   OR (scope = 'platform')
               )
             ORDER BY scope DESC, usage_count DESC
             LIMIT 20`,
            [tenantId, flavor ?? null],
        );
        return result.rows
            .map(r => r.implementation?.system)
            .filter((s): s is string => typeof s === 'string' && s.length > 0);
    } catch (err: any) {
        // Pre-migration or DB error — degrade gracefully
        console.error(`[self-improvement] Failed to load skills for tenant ${tenantId}:`, err.message);
        return [];
    }
}

// ─── Legacy API (kept for backwards compatibility) ────────────────────────────

export interface SelfImprovementEvent {
    type: "ERROR" | "LEARNING" | "PATTERN";
    code: string;
    description: string;
    context: any;
}

export async function logLearning(event: SelfImprovementEvent): Promise<void> {
    const action = `self_improvement_${event.type.toLowerCase()}`;
    try {
        await logAdminEvent(action, undefined, {
            code: event.code,
            description: event.description,
            context: event.context,
        });
        console.log(`[self-improvement] Logged ${event.type}: ${event.code}`);
    } catch (err) {
        console.error("[self-improvement] Failed to log learning:", err);
    }
}

export async function analyzePatterns(tenantId: string): Promise<string[]> {
    const pool = getPool();
    try {
        const result = await pool.query<{ trigger_tool: string; cnt: string }>(
            `SELECT trigger_tool, COUNT(*) as cnt
             FROM skills
             WHERE tenant_id = $1
               AND status = 'draft'
               AND created_by = 'agent'
               AND created_at > now() - INTERVAL '7 days'
             GROUP BY trigger_tool
             HAVING COUNT(*) >= 2
             ORDER BY cnt DESC`,
            [tenantId],
        );
        return result.rows.map(r => `Recurring failures in ${r.trigger_tool} (${r.cnt} times this week) — review drafts.`);
    } catch {
        return [`Pattern recognition active for tenant: ${tenantId}`];
    }
}

export async function promoteToCore(learningCode: string, targetFile: string): Promise<void> {
    console.log(`[self-improvement] PROMOTING ${learningCode} to ${targetFile}...`);
    // Admin-driven promotion goes through the curation routes (POST /admin/skills/:id/promote)
}
