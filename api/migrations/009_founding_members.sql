-- Founding member recognition and retention mechanics
-- Founding members are the first tenants in each vertical+region combination.
-- They seed the community signal that all future tenants benefit from.
-- They receive permanent recognition and locked-in pricing in return.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS is_founding_member    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_member_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS founding_vertical     TEXT,
  ADD COLUMN IF NOT EXISTS founding_region       TEXT,
  ADD COLUMN IF NOT EXISTS founding_member_rank  INTEGER;  -- 1st, 2nd, 3rd in their vertical+region

-- Track when founding member status was granted and why
CREATE TABLE IF NOT EXISTS founding_member_events (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  event_type  TEXT NOT NULL,  -- 'granted' | 'milestone_reached' | 'counter_updated'
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View: current founding member leaderboard per vertical+region
CREATE OR REPLACE VIEW founding_member_stats AS
SELECT
  t.id,
  t.slug,
  t.vertical,
  t.region,
  t.founding_member_rank,
  t.founding_member_since,
  t.hive_events_contributed,
  t.hive_signals_received,
  -- Contribution percentile within vertical+region
  PERCENT_RANK() OVER (
    PARTITION BY t.vertical, t.region
    ORDER BY t.hive_events_contributed
  ) AS contribution_percentile
FROM tenants t
WHERE t.is_founding_member = true
ORDER BY t.vertical, t.region, t.hive_events_contributed DESC;
