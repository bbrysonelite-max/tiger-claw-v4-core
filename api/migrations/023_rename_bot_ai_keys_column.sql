-- Migration 023: Rename bot_ai_keys.bot_id → tenant_id
-- addAIKey() in db.ts inserts using column name `tenant_id`, but migration 005
-- created the column as `bot_id`. Every call to addAIKey() has silently failed
-- since the schema was unified in migration 002. This fix unbreaks multi-key
-- rotation and the 4-layer Gemini key fallback.

DO $$ BEGIN
  ALTER TABLE bot_ai_keys RENAME COLUMN bot_id TO tenant_id;
EXCEPTION
  WHEN undefined_column THEN NULL; -- already renamed, idempotent
  WHEN OTHERS THEN RAISE;
END $$;

-- Update the index to match the new column name
DROP INDEX IF EXISTS idx_bot_ai_keys_bot;
CREATE INDEX IF NOT EXISTS idx_bot_ai_keys_tenant ON bot_ai_keys(tenant_id);
