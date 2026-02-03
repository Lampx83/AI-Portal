-- Nguồn phiên chat: 'web' (trang chính) hoặc 'embed' (mã nhúng) – phục vụ quản lý
ALTER TABLE research_chat.chat_sessions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

COMMENT ON COLUMN research_chat.chat_sessions.source IS 'web = từ trang chính, embed = từ mã nhúng (iframe)';

CREATE INDEX IF NOT EXISTS idx_sessions_source ON research_chat.chat_sessions(source);
