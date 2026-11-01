-- Migration 027: cột phục vụ phân tích nghiên cứu (AR-2, bài W8 + nền cho A/B ở W25).
-- Trước đây messages không gán được cho người dùng (user_id luôn NULL) và model_id là nhãn do client gửi.
-- Nay:
--   user_id            chủ tin nhắn (điền ngược từ chat_sessions.user_id; ghi phía máy chủ từ nay)
--   model_id_served    model THỰC SỰ được gọi, do máy chủ ghi (khác model_id = nhãn client gửi)
--   model_provider     nhà cung cấp của model đó (openai | openai_compatible | ...)
--   served_status      ok | fallback | error: kết quả của lượt phục vụ (NULL = chưa biết, tin nhắn cũ / trợ lý ngoài không báo)
--   profile_injected   lượt Central có chèn hồ sơ người dùng vào prompt không
--   experiment_id, arm nhóm thực nghiệm (để trống cho tới khi bật AR-3)
-- Idempotent; không xoá/ghi đè dữ liệu có sẵn. Bảng messages ~8 nghìn dòng nên điền ngược rẻ.

ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL;
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS model_id_served TEXT;
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS model_provider TEXT;
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS served_status TEXT;
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS profile_injected BOOLEAN;
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS experiment_id TEXT;
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS arm TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messages_served_status_chk' AND conrelid = 'ai_portal.messages'::regclass
  ) THEN
    ALTER TABLE ai_portal.messages
      ADD CONSTRAINT messages_served_status_chk
      CHECK (served_status IS NULL OR served_status IN ('ok', 'fallback', 'error'));
  END IF;
END $$;

-- Điền ngược chủ tin nhắn từ phiên chat (chỉ dòng còn NULL).
UPDATE ai_portal.messages m
SET user_id = s.user_id
FROM ai_portal.chat_sessions s
WHERE m.session_id = s.id
  AND m.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_user_created ON ai_portal.messages(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_experiment ON ai_portal.messages(experiment_id, arm) WHERE experiment_id IS NOT NULL;
