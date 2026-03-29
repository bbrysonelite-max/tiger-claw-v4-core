-- Tiger Claw — Migration 019
-- Adds bot_username to tenants table to support BYOB tokens without constant Telegram API calls.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS bot_username TEXT;
