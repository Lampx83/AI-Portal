-- Bảng công bố của người dùng (Công bố của tôi)
CREATE TABLE IF NOT EXISTS research_chat.publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]',
  journal TEXT,
  year INTEGER,
  type TEXT CHECK (type IN ('journal', 'conference', 'book', 'thesis')),
  status TEXT CHECK (status IN ('published', 'accepted', 'submitted', 'draft')),
  doi TEXT,
  abstract TEXT,
  file_keys JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_publications_user_id ON research_chat.publications(user_id);
