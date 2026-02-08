-- Phản hồi, góp ý của người dùng về hệ thống (chung hoặc theo từng trợ lý)
CREATE TABLE IF NOT EXISTS research_chat.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  assistant_alias TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_note TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES research_chat.users(id) ON DELETE SET NULL
);

-- Đảm bảo các cột tồn tại (trường hợp bảng đã tạo trước đó với schema cũ)
ALTER TABLE research_chat.user_feedback ADD COLUMN IF NOT EXISTS assistant_alias TEXT;
ALTER TABLE research_chat.user_feedback ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE research_chat.user_feedback ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE research_chat.user_feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE research_chat.user_feedback ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES research_chat.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON research_chat.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_assistant_alias ON research_chat.user_feedback(assistant_alias);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON research_chat.user_feedback(created_at DESC);

COMMENT ON TABLE research_chat.user_feedback IS 'Phản hồi, góp ý của người dùng về hệ thống (chung hoặc theo trợ lý cụ thể)';
COMMENT ON COLUMN research_chat.user_feedback.admin_note IS 'Ghi chú của quản trị viên';
COMMENT ON COLUMN research_chat.user_feedback.resolved IS 'Đã xử lý góp ý hay chưa';
COMMENT ON COLUMN research_chat.user_feedback.resolved_at IS 'Thời điểm đánh dấu đã xử lý';
COMMENT ON COLUMN research_chat.user_feedback.resolved_by IS 'Quản trị viên đánh dấu đã xử lý';
