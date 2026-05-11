-- Migration 007: Page views tracking
-- Mỗi lượt vào trang (client gửi POST /api/track/pageview khi pathname đổi).

CREATE TABLE IF NOT EXISTS ai_portal.page_views (
  id              BIGSERIAL PRIMARY KEY,
  path            TEXT NOT NULL,
  user_id         UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
  guest_device_id TEXT,
  user_agent      TEXT,
  referrer        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON ai_portal.page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON ai_portal.page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON ai_portal.page_views(user_id) WHERE user_id IS NOT NULL;
