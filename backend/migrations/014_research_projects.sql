-- Bảng dự án nghiên cứu (Nghiên cứu của tôi)
CREATE TABLE IF NOT EXISTS research_chat.research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  team_members JSONB NOT NULL DEFAULT '[]',
  file_keys JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_projects_user_id ON research_chat.research_projects(user_id);
