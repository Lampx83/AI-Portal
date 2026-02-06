-- Tài khoản Khách: dùng khi người dùng chưa đăng nhập, dữ liệu chat lưu theo user Khách
-- ID cố định để backend dễ kiểm tra
INSERT INTO research_chat.users (id, email, display_name, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'guest@research.local',
  'Khách',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW();

-- Giới hạn: mỗi thiết bị (device_id) chỉ được 1 tin nhắn/ngày/trợ lý khi dùng tài khoản Khách
CREATE TABLE IF NOT EXISTS research_chat.guest_device_daily_usage (
  device_id        TEXT NOT NULL,
  assistant_alias  TEXT NOT NULL,
  usage_date       DATE NOT NULL DEFAULT current_date,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (device_id, assistant_alias, usage_date)
);

COMMENT ON TABLE research_chat.guest_device_daily_usage IS 'Đếm tin nhắn dùng thử của khách: 1 tin/ngày/thiết bị/trợ lý. Frontend gửi guest_device_id (lưu localStorage).';
