-- Migration 005: Transform Ephemeral JSON Files into Relational Tenant Data
-- Supports leads, contacts, nurture sequences, and tenant system states.

-- 1. Leads Table (Replaces leads.json)
-- We extract key fields to index them for the upcoming Customer Dashboard.
CREATE TABLE IF NOT EXISTS tenant_leads (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    platform_id VARCHAR(255) NOT NULL,
    display_name TEXT NOT NULL,
    profile_url TEXT,
    builder_score INTEGER NOT NULL DEFAULT 0,
    customer_score INTEGER NOT NULL DEFAULT 0,
    qualifying_score INTEGER NOT NULL DEFAULT 0,
    qualified BOOLEAN NOT NULL DEFAULT FALSE,
    opted_out BOOLEAN NOT NULL DEFAULT FALSE,
    manual_status VARCHAR(50),
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_scored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, platform, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_leads_tenant_id ON tenant_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_leads_qualified ON tenant_leads(tenant_id, qualified, opted_out);
CREATE INDEX IF NOT EXISTS idx_tenant_leads_score ON tenant_leads(tenant_id, qualifying_score DESC);

-- 2. Contacts Table (Replaces contacts.json)
CREATE TABLE IF NOT EXISTS tenant_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    lead_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_contacts_tenant_id ON tenant_contacts(tenant_id);

-- 3. Nurture Sequences Table (Replaces nurture.json)
CREATE TABLE IF NOT EXISTS tenant_nurture (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    lead_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    raw_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_nurture_tenant_id ON tenant_nurture(tenant_id);

-- 4. Key/Value State Table (Replaces scout_state.json, onboard_state.json, settings.json, key_state.json)
-- Used for small dictionaries that don't need relational pagination.
CREATE TABLE IF NOT EXISTS tenant_states (
    tenant_id VARCHAR(255) NOT NULL,
    state_key VARCHAR(100) NOT NULL,   -- e.g., 'scout_state', 'onboard_state', 'settings', 'key_state'
    state_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, state_key)
);
