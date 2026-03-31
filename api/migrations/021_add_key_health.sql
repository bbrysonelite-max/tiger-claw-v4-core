-- Migration: Add key health tracking to tenants
-- Job 2: Proactive key health monitoring

ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS key_health TEXT DEFAULT 'healthy',
ADD COLUMN IF NOT EXISTS key_health_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create an index for faster filtering of healthy/unhealthy tenants if needed
CREATE INDEX IF NOT EXISTS idx_tenants_key_health ON tenants(key_health);
