-- Bình luận trên bài viết (nhiều người có thể cùng comment)
-- Mỗi comment gắn với một vùng text trong content (span data-comment-id trong HTML)
CREATE TABLE IF NOT EXISTS research_chat.write_article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES research_chat.write_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  author_display TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  parent_id UUID REFERENCES research_chat.write_article_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_article_comments_article_id ON research_chat.write_article_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_write_article_comments_parent_id ON research_chat.write_article_comments(parent_id);

COMMENT ON TABLE research_chat.write_article_comments IS 'Bình luận trên bài viết; vùng text được đánh dấu bằng span data-comment-id trong content';
