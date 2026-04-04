-- Migration 024: Fix bot_ai_keys.tenant_id FK to reference tenants instead of bots
-- Migration 005 created bot_ai_keys with REFERENCES bots(id), but bots was unified
-- into tenants in migration 002. All addAIKey() calls use tenants UUIDs.
-- Migration 023 renamed the column; this migration fixes the FK target.

DO $$ DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the FK constraint on bot_ai_keys.tenant_id (or bot_id pre-023) that references bots
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_class f ON f.oid = c.confrelid
  WHERE t.relname = 'bot_ai_keys'
    AND f.relname = 'bots'
    AND c.contype = 'f';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE bot_ai_keys DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped FK constraint % from bot_ai_keys', constraint_name;
  END IF;
END $$;

-- Add correct FK referencing tenants. Use ON DELETE SET NULL (not CASCADE) so a
-- hard-deleted tenant doesn't silently wipe key records that may be needed for audit.
ALTER TABLE bot_ai_keys
  ADD CONSTRAINT bot_ai_keys_tenant_id_fk
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
