-- Bảng lưu bài viết của trợ lý Viết (write assistant)
-- Mỗi user có thể có nhiều bài viết, mỗi bài có tiêu đề và nội dung HTML
CREATE TABLE IF NOT EXISTS research_chat.write_articles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'Tài liệu chưa có tiêu đề',
  content          TEXT NOT NULL DEFAULT '',
  template_id      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_articles_user_id ON research_chat.write_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_write_articles_updated_at ON research_chat.write_articles(updated_at DESC);

COMMENT ON TABLE research_chat.write_articles IS 'Bài viết/tài liệu của user trong trợ lý Viết (write assistant)';
