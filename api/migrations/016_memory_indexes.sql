-- Memory Architecture V4.1 — index improvements for fast prompt enrichment
-- Phase 1: buildMemoryContext() queries tenant_states and hive_signals on every request

-- Speed up onboard_state and fact_anchors lookups (Phase 1 + Phase 3)
CREATE INDEX IF NOT EXISTS idx_tenant_states_key
  ON tenant_states(state_key)
  WHERE state_key IN ('fact_anchors', 'onboard_state');

-- Track when a state key was last read (useful for staleness monitoring)
ALTER TABLE tenant_states
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;
