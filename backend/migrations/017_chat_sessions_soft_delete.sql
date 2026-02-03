-- Soft delete cho chat_sessions: khi user "xoá" chat thì chỉ đánh dấu deleted_at,
-- không xóa thật để tin nhắn vẫn tính vào quota.
ALTER TABLE research_chat.chat_sessions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN research_chat.chat_sessions.deleted_at IS 'Thời điểm user xoá phiên chat. NULL = chưa xoá. Dùng soft delete để quota vẫn tính.';

CREATE INDEX IF NOT EXISTS idx_chat_sessions_deleted_at
  ON research_chat.chat_sessions(deleted_at)
  WHERE deleted_at IS NULL;
