-- Gắn bài viết với Project (Nghiên cứu) – mỗi bài viết thuộc một project
ALTER TABLE research_chat.write_articles
  ADD COLUMN IF NOT EXISTS research_id UUID REFERENCES research_chat.research_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_write_articles_research_id
  ON research_chat.write_articles(research_id) WHERE research_id IS NOT NULL;

COMMENT ON COLUMN research_chat.write_articles.research_id IS 'Project (nghiên cứu) mà bài viết thuộc về; NULL = chưa gắn project';
