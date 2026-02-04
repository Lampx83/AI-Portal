-- Bảng ghi nhận mỗi lần đăng nhập (phục vụ thống kê đăng nhập theo ngày)
CREATE TABLE IF NOT EXISTS research_chat.login_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  login_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider   TEXT
);

CREATE INDEX IF NOT EXISTS idx_login_events_login_at ON research_chat.login_events(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON research_chat.login_events(user_id);

COMMENT ON TABLE research_chat.login_events IS 'Lịch sử đăng nhập theo từng lần (credentials, azure-ad, ...)';
