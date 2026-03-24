-- Migration 012: Add released_at to bot_pool for cool-down enforcement
-- Prevents immediate re-assignment of just-released bots (Telegram profile may still show
-- previous tenant's branding for up to 30 minutes after deleteWebhook + identity reset).
-- assignBotToken skips bots released within the last 30 minutes.

ALTER TABLE bot_pool
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Index to make the cool-down WHERE clause efficient
CREATE INDEX IF NOT EXISTS idx_bot_pool_released_at ON bot_pool(released_at)
  WHERE status = 'available';
