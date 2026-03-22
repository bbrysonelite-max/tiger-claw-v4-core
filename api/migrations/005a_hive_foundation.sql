-- Tenant vertical + region + hive consent
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS vertical        TEXT,
  ADD COLUMN IF NOT EXISTS region          TEXT,
  ADD COLUMN IF NOT EXISTS hive_opt_in     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hive_events_contributed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hive_signals_received   INTEGER NOT NULL DEFAULT 0;

-- Append-only raw event store (private, never tenant-visible)
CREATE TABLE IF NOT EXISTS hive_events (
  id              BIGSERIAL PRIMARY KEY,
  tenant_hash     TEXT NOT NULL,          -- sha256(tenantId).slice(0,16), never raw ID
  vertical        TEXT NOT NULL,
  region          TEXT NOT NULL,
  event_type      TEXT NOT NULL,          -- 'objection' | 'conversion' | 'score' | 'scout_hit'
  payload         JSONB NOT NULL,         -- anonymized signal data
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hive_events_vertical_region ON hive_events(vertical, region);
CREATE INDEX IF NOT EXISTS idx_hive_events_type            ON hive_events(event_type);
CREATE INDEX IF NOT EXISTS idx_hive_events_created         ON hive_events(created_at);

-- Aggregated signals (written by aggregation worker, read by tools)
CREATE TABLE IF NOT EXISTS hive_signals (
  id              BIGSERIAL PRIMARY KEY,
  signal_key      TEXT NOT NULL UNIQUE,   -- e.g. "objections:saas:sea" | "timing:realestate:latam"
  vertical        TEXT NOT NULL,
  region          TEXT NOT NULL,
  signal_type     TEXT NOT NULL,
  payload         JSONB NOT NULL,
  sample_size     INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hive_signals_key ON hive_signals(signal_key);

-- Scout company profile cache (shared across all tenants)
CREATE TABLE IF NOT EXISTS hive_scout_cache (
  company_key     TEXT PRIMARY KEY,       -- sha256(domain | company_name)
  profile         JSONB NOT NULL,
  scout_count     INTEGER NOT NULL DEFAULT 1,
  first_scouted   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);
