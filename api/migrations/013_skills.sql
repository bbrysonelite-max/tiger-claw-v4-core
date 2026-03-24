-- Migration 013: Skills table for dynamic agent capabilities
-- Supports: prompt skills (type='prompt'), template skills (type='template')
-- Future: code skills (type='code')
-- Scope: tenant | flavor | platform
-- Status flow: draft → submitted → approved | rejected | platform

CREATE TABLE IF NOT EXISTS skills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('prompt', 'template', 'code')),
    scope           TEXT NOT NULL DEFAULT 'tenant' CHECK (scope IN ('tenant', 'flavor', 'platform')),
    tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
    flavor          TEXT,
    status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'platform')),

    -- The skill implementation — content depends on type:
    --   prompt: { "system": "..." } — appended to system prompt
    --   template: { "template": "...", "variables": [...] } — parameterized text block
    --   code: { "handler": "..." } — function body (future)
    implementation  JSONB NOT NULL DEFAULT '{}',

    -- Optional: JSON Schema describing parameters this skill accepts
    parameters      JSONB,

    -- Originating failure context (auto-drafted skills)
    trigger_tool    TEXT,           -- which tool failed (e.g. "tiger_scout")
    trigger_args    JSONB,          -- args that were passed when it failed
    trigger_error   TEXT,           -- the error message

    -- Metrics
    usage_count     INTEGER NOT NULL DEFAULT 0,
    success_count   INTEGER NOT NULL DEFAULT 0,

    created_by      TEXT,           -- 'agent' (auto-drafted) | 'admin' | tenant_id
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: a tenant can only have one approved skill per name
CREATE UNIQUE INDEX IF NOT EXISTS skills_tenant_name_approved_idx
    ON skills (tenant_id, name)
    WHERE status IN ('approved', 'platform');

-- Fast lookup: load approved skills for a tenant/flavor conversation
CREATE INDEX IF NOT EXISTS skills_tenant_status_idx
    ON skills (tenant_id, status);

CREATE INDEX IF NOT EXISTS skills_flavor_status_idx
    ON skills (flavor, status)
    WHERE scope IN ('flavor', 'platform');

CREATE INDEX IF NOT EXISTS skills_platform_status_idx
    ON skills (status)
    WHERE scope = 'platform';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_skills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS skills_updated_at ON skills;
CREATE TRIGGER skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW EXECUTE FUNCTION set_skills_updated_at();
