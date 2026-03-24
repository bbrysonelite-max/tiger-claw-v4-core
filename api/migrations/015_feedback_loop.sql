-- Founding member feedback loop
-- Weekly check-in enforcement: no feedback = agent pauses.
-- The exchange: free access + founding member status in return for weekly signal.

-- Weekly feedback from founding members (and any tenant on the feedback loop)
CREATE TABLE IF NOT EXISTS tenant_feedback (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  coaching_reply  TEXT,                    -- what the agent said back
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_tenant_created
  ON tenant_feedback (tenant_id, created_at DESC);

-- Track feedback loop state per tenant
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS feedback_loop_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_feedback_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_paused          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feedback_pause_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_reminder_sent_at TIMESTAMPTZ;

-- Enable feedback loop for founding members automatically
-- (run after is_founding_member is set)
CREATE OR REPLACE FUNCTION enable_feedback_loop_for_founders()
RETURNS void LANGUAGE sql AS $$
  UPDATE tenants
  SET feedback_loop_enabled = true
  WHERE is_founding_member = true
    AND feedback_loop_enabled = false;
$$;
