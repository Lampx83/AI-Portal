-- Bảng đếm số tin nhắn user đã gửi mỗi ngày - dùng cho quota, KHÔNG giảm khi xóa message
-- Tránh lỗ hổng: user gửi 10 tin → xóa một số → quota được cộng lại
CREATE TABLE IF NOT EXISTS research_chat.user_daily_message_sends (
  user_id    UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  send_date  DATE NOT NULL DEFAULT current_date,
  count      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, send_date)
);

COMMENT ON TABLE research_chat.user_daily_message_sends IS 'Số tin nhắn user đã gửi mỗi ngày - chỉ tăng khi gửi, không giảm khi xóa. Dùng cho quota.';

CREATE INDEX IF NOT EXISTS idx_user_daily_message_sends_date
  ON research_chat.user_daily_message_sends(send_date);

-- Backfill từ messages hiện có cho ngày hôm nay (chỉ chạy khi bảng mới tạo, chưa có dữ liệu)
INSERT INTO research_chat.user_daily_message_sends (user_id, send_date, count)
SELECT s.user_id, current_date, COUNT(*)::int
FROM research_chat.messages m
JOIN research_chat.chat_sessions s ON s.id = m.session_id
WHERE m.role = 'user' AND m.created_at >= date_trunc('day', now())
GROUP BY s.user_id
ON CONFLICT (user_id, send_date) DO UPDATE SET count = GREATEST(research_chat.user_daily_message_sends.count, EXCLUDED.count);
