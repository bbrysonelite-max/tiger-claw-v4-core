-- Migration 025: Add missing indexes identified in April 2026 audit
-- All use IF NOT EXISTS so this is safe to re-run.

-- subscriptions table: frequently queried by user_id and tenant_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);

-- tenant_states: the hot path for getBotState/setBotState — composite index matches the WHERE clause exactly
CREATE INDEX IF NOT EXISTS idx_tenant_states_tenant_key ON tenant_states(tenant_id, state_key);

-- tenant_leads: opted_out filter used in lead queries and value-gap detection
CREATE INDEX IF NOT EXISTS idx_tenant_leads_opted_out ON tenant_leads(opted_out);
