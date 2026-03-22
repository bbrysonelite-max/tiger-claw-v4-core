-- 1. Engagement Speed Signal (future)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS avg_lead_reply_hours NUMERIC(6,2);

-- 2. Performance Indexes for ICP Aggregation Worker
CREATE INDEX IF NOT EXISTS idx_hive_events_tenant_hash 
  ON hive_events(tenant_hash, vertical, region, event_type);

CREATE INDEX IF NOT EXISTS idx_hive_events_payload_source 
  ON hive_events USING GIN (payload jsonb_path_ops);

-- 3. Audit view for admin dashboard health
CREATE OR REPLACE VIEW hive_icp_signal_health AS
SELECT
  vertical,
  region,
  sample_size AS scouted_count,
  EXTRACT(EPOCH FROM (now() - updated_at))/3600 AS hours_since_update,
  payload->'topConvertingProfiles' AS top_profiles,
  updated_at AS latest_signal_at
FROM hive_signals
WHERE signal_type = 'ideal_customer_profile';
