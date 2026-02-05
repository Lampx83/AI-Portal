-- Thông báo cho người dùng: từ hệ thống/quản trị hoặc mời tham gia nghiên cứu
CREATE TABLE IF NOT EXISTS research_chat.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE research_chat.notifications IS 'Thông báo: system (quản trị), research_invite (mời tham gia nghiên cứu)';
COMMENT ON COLUMN research_chat.notifications.payload IS 'Ví dụ research_invite: { research_id, research_name, inviter_email, inviter_name }';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON research_chat.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON research_chat.notifications(created_at DESC);
