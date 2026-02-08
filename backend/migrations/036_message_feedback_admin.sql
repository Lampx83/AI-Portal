-- Thêm cột quản trị cho message_feedback: ghi chú và đánh dấu đã xử lý
ALTER TABLE research_chat.message_feedback ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE research_chat.message_feedback ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE research_chat.message_feedback ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE research_chat.message_feedback ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES research_chat.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN research_chat.message_feedback.admin_note IS 'Ghi chú của quản trị viên';
COMMENT ON COLUMN research_chat.message_feedback.resolved IS 'Đã xử lý góp ý hay chưa';
COMMENT ON COLUMN research_chat.message_feedback.resolved_at IS 'Thời điểm đánh dấu đã xử lý';
COMMENT ON COLUMN research_chat.message_feedback.resolved_by IS 'Quản trị viên đánh dấu đã xử lý';
