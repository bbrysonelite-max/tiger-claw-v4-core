-- Migration 017: Market Intelligence Table (v5 Sovereign Data Moat)
-- The global cross-tenant fact store. Powers hive signal injection,
-- cross-flavor alchemy, and the Reflexion Loop on the Mac cluster.
-- This table was previously self-created via initMarketIntelSchema() at
-- API startup. This migration moves it into the tracked schema pipeline.

CREATE TABLE IF NOT EXISTS market_intelligence (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  domain         TEXT         NOT NULL,
  category       TEXT         NOT NULL,
  entity_id      TEXT,
  entity_label   TEXT,
  fact_summary   TEXT         NOT NULL,
  confidence_score INTEGER    DEFAULT 0,
  mining_cost    NUMERIC(10,6) DEFAULT 0,
  source_url     TEXT,
  captured_by    TEXT         DEFAULT 'unknown',
  metadata       JSONB        DEFAULT '{}',
  verified_at    TIMESTAMPTZ  DEFAULT NOW(),
  valid_until    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_intel_domain    ON market_intelligence(domain);
CREATE INDEX IF NOT EXISTS idx_market_intel_category  ON market_intelligence(category);
CREATE INDEX IF NOT EXISTS idx_market_intel_entity    ON market_intelligence(entity_id);
CREATE INDEX IF NOT EXISTS idx_market_intel_validity  ON market_intelligence(valid_until);

-- Fact decay: purge facts past their valid_until date.
-- Runs as a no-op if no expired facts exist.
DELETE FROM market_intelligence
WHERE valid_until IS NOT NULL AND valid_until < NOW();
