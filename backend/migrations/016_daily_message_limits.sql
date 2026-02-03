-- Giới hạn tin nhắn mỗi ngày theo user và theo agent
-- User: cột daily_message_limit (mặc định 10), override theo ngày
-- Agent: daily_message_limit trong config_json (mặc định 100, cấu hình trong admin)

-- Cột giới hạn tin nhắn/ngày cho mỗi user (mặc định 10)
ALTER TABLE research_chat.users
  ADD COLUMN IF NOT EXISTS daily_message_limit INTEGER NOT NULL DEFAULT 10;

COMMENT ON COLUMN research_chat.users.daily_message_limit IS 'Số tin nhắn tối đa mỗi user được gửi mỗi ngày (mặc định 10). Admin có thể mở thêm qua user_daily_limit_overrides.';

-- Bảng override: admin mở thêm tin nhắn cho user trong một ngày cụ thể
CREATE TABLE IF NOT EXISTS research_chat.user_daily_limit_overrides (
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL DEFAULT (current_date),
  extra_messages INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, override_date)
);

COMMENT ON TABLE research_chat.user_daily_limit_overrides IS 'Admin mở thêm số tin nhắn cho user trong ngày override_date (chỉ áp dụng ngày đó).';

CREATE INDEX IF NOT EXISTS idx_user_daily_limit_overrides_date
  ON research_chat.user_daily_limit_overrides(override_date);
