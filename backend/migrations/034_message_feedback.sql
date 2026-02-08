-- Like/Dislike phản hồi của user cho từng tin nhắn trợ lý (để thống kê và cải thiện trợ lý)
CREATE TABLE IF NOT EXISTS research_chat.message_feedback (
  message_id UUID NOT NULL REFERENCES research_chat.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('like', 'dislike')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON research_chat.message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_feedback ON research_chat.message_feedback(feedback);

ALTER TABLE research_chat.message_feedback ADD COLUMN IF NOT EXISTS comment TEXT;

COMMENT ON TABLE research_chat.message_feedback IS 'Đánh giá like/dislike của user cho câu trả lời trợ lý; dùng cho thống kê và cải thiện trợ lý';
COMMENT ON COLUMN research_chat.message_feedback.comment IS 'Mô tả của user khi dislike (báo lỗi cho nhà phát triển)';