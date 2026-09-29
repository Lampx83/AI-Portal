-- Migration 019: Short URLs (dùng cho app QR Code — rút gọn link để mã QR đơn giản hơn)
CREATE TABLE IF NOT EXISTS ai_portal.short_urls (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  target_url      TEXT NOT NULL,
  source          TEXT,
  created_by      UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
  guest_device_id TEXT,
  click_count     BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_clicked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_short_urls_created_at ON ai_portal.short_urls(created_at DESC);
