-- Unify 'bots' and 'users' into the 'tenants' table

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- Wait, what if the columns don't exist? The IF EXISTS clause in Postgres ALTER TABLE RENAME COLUMN is tricky.
DO $$
BEGIN
  BEGIN
    ALTER TABLE bot_ai_config RENAME COLUMN bot_id TO tenant_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;

  BEGIN
    ALTER TABLE IF EXISTS bot_ai_keys RENAME COLUMN bot_id TO tenant_id;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN undefined_column THEN
      NULL;
  END;

  BEGIN
    ALTER TABLE subscriptions RENAME COLUMN bot_id TO tenant_id;
  EXCEPTION
    WHEN undefined_column THEN
      NULL;
  END;
END $$;
