-- Lịch sử phiên bản bài viết (theo dõi chỉnh sửa, quay lại phiên bản trước)
CREATE TABLE IF NOT EXISTS research_chat.write_article_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES research_chat.write_articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_article_versions_article_id ON research_chat.write_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_write_article_versions_created_at ON research_chat.write_article_versions(article_id, created_at DESC);

COMMENT ON TABLE research_chat.write_article_versions IS 'Snapshot phiên bản bài viết khi lưu; dùng để xem lịch sử và khôi phục';
