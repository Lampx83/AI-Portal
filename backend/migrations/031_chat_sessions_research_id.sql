-- Mỗi nghiên cứu có lịch sử chat riêng: gắn phiên chat với dự án nghiên cứu
ALTER TABLE research_chat.chat_sessions
  ADD COLUMN IF NOT EXISTS research_id UUID REFERENCES research_chat.research_projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN research_chat.chat_sessions.research_id IS 'Dự án nghiên cứu (Nghiên cứu) gắn với phiên chat; NULL = chat chung không thuộc dự án';

CREATE INDEX IF NOT EXISTS idx_sessions_research_id ON research_chat.chat_sessions(research_id);
