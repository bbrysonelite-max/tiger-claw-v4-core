-- Migration 014: Prevent duplicate draft skills for the same tenant+name
--
-- Bug: draftSkillFromFailure uses ON CONFLICT DO NOTHING, but the only unique
-- index on skills (skills_tenant_name_approved_idx) is partial — it only covers
-- status IN ('approved', 'platform'). Draft inserts never conflict, so the same
-- tool failure produces unlimited duplicate rows.
--
-- Fix: add a second partial unique index covering draft status.
-- This allows ON CONFLICT DO NOTHING to correctly deduplicate draft skills
-- while preserving the ability to re-draft after a skill is approved/rejected.

CREATE UNIQUE INDEX IF NOT EXISTS skills_tenant_name_draft_idx
    ON skills (tenant_id, name)
    WHERE status = 'draft';
