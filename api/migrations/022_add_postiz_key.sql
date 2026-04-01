-- Migration 022: Add Postiz API key for autonomous social broadcasting
-- TIGERCLAW-MASTER-SPEC-v2.md Block 5.1 Extension

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS postiz_api_key TEXT;

-- Log the addition (admin_events uses: action, details JSONB, tenant_id, created_at)
INSERT INTO admin_events (action, details)
VALUES ('schema_update', '{"migration": "022_add_postiz_key", "feature": "Postiz Integration"}'::jsonb);
