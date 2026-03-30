-- Tiger Strike — Database Migration 018
-- Creates the strike_drafts table and extends market_intelligence for engagement tracking.
-- Part of Phase 2: Sabbertooth-to-Tiger Strike Assimilation.

-- ---------------------------------------------------------------------------
-- 1. Extend market_intelligence with engagement tracking columns
-- ---------------------------------------------------------------------------

ALTER TABLE market_intelligence
  ADD COLUMN IF NOT EXISTS engagement_status TEXT DEFAULT 'unengaged',
  ADD COLUMN IF NOT EXISTS queued_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS engaged_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_reason   TEXT;

CREATE INDEX IF NOT EXISTS idx_mi_engagement_status
  ON market_intelligence (engagement_status);

-- Note: confidence changed to confidence_score in current schema
CREATE INDEX IF NOT EXISTS idx_mi_domain_confidence
  ON market_intelligence (domain, confidence_score DESC)
  WHERE COALESCE(engagement_status, 'unengaged') = 'unengaged';

-- ---------------------------------------------------------------------------
-- 2. Create strike_drafts table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS strike_drafts (
  id                  TEXT PRIMARY KEY,
  fact_id             UUID NOT NULL REFERENCES market_intelligence(id),
  tenant_id           TEXT NOT NULL,
  platform            TEXT NOT NULL,
  source_url          TEXT NOT NULL,
  entity_label        TEXT NOT NULL,
  fact_summary        TEXT NOT NULL,
  drafted_reply       TEXT NOT NULL,
  engagement_score    INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending_review',
  intent_generated_at TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sd_tenant_status
  ON strike_drafts (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_sd_tenant_score
  ON strike_drafts (tenant_id, engagement_score DESC)
  WHERE status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_sd_fact_id
  ON strike_drafts (fact_id);

-- ---------------------------------------------------------------------------
-- 3. Engagement metrics view
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW strike_engagement_summary AS
SELECT
  sd.tenant_id,
  sd.platform,
  COUNT(*)                                                    AS total_drafts,
  COUNT(*) FILTER (WHERE sd.status = 'pending_review')        AS pending,
  COUNT(*) FILTER (WHERE sd.status = 'approved')              AS approved,
  COUNT(*) FILTER (WHERE sd.status = 'intent_generated')      AS intent_generated,
  COUNT(*) FILTER (WHERE sd.status = 'confirmed')             AS confirmed,
  COUNT(*) FILTER (WHERE sd.status = 'rejected')              AS rejected,
  ROUND(AVG(sd.engagement_score), 1)                          AS avg_score,
  MAX(sd.created_at)                                          AS last_draft_at,
  MAX(sd.confirmed_at)                                        AS last_confirmed_at
FROM strike_drafts sd
GROUP BY sd.tenant_id, sd.platform;
