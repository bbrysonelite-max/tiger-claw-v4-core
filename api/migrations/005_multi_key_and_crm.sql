-- Migration 005: Multi-Key Rotation + CRM Contacts (Circle of Influence)
-- Supports 4-way AI rotation and instant Hunter Framework data import

-- 1. Multi-Key Rotation Table
-- Drops the unique constraint on bot_id from bot_ai_config or creates a new one
CREATE TABLE IF NOT EXISTS bot_ai_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id          UUID REFERENCES bots(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL, -- google, openai, grok, anthropic, etc.
  model           TEXT NOT NULL,
  encrypted_key   TEXT NOT NULL,
  key_preview     TEXT,
  priority        INTEGER DEFAULT 0, -- 0 is primary, 1-3 are fallbacks
  status          TEXT DEFAULT 'active', -- active, rate_limited, invalid
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_ai_keys_bot ON bot_ai_keys(bot_id);

-- 2. CRM / Circle of Influence Table
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  status          TEXT DEFAULT 'new', -- new, analyzing, qualifying, nurtured
  probability     INTEGER DEFAULT 0, -- 0-100 score from AI ranking
  last_contact_at TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
