-- Fix subscriptions FK constraint broken by migration 002_unify_tenants.sql
--
-- Migration 002 renamed subscriptions.bot_id → tenant_id but the FK constraint
-- still references bots(id). Every subscription insert since then fails with:
--   "violates foreign key constraint subscriptions_bot_id_fkey"
-- because createBYOKBot inserts into tenants, not bots.
--
-- Fix: drop the stale bots FK, add correct FK to tenants.

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_bot_id_fkey;

DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists, safe to skip
END $$;
