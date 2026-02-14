-- Cấu hình giới hạn tin nhắn cho người dùng chưa đăng nhập (guest)
-- Bảng app_settings dùng cho các cấu hình runtime có thể chỉnh trong admin
CREATE TABLE IF NOT EXISTS research_chat.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

COMMENT ON TABLE research_chat.app_settings IS 'Cấu hình runtime (vd. guest_daily_message_limit). Có thể sửa trong trang Admin > Message Limits.';

INSERT INTO research_chat.app_settings (key, value) VALUES ('guest_daily_message_limit', '1')
ON CONFLICT (key) DO NOTHING;

-- Thêm cột message_count để hỗ trợ N tin/ngày/thiết bị/trợ lý (trước đây cố định 1)
ALTER TABLE research_chat.guest_device_daily_usage
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN research_chat.guest_device_daily_usage.message_count IS 'Số tin nhắn khách đã gửi trong ngày (device + assistant).';
