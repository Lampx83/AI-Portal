-- Chia sẻ bài viết: link cho phép nhiều người cùng chỉnh sửa
ALTER TABLE research_chat.write_articles
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_write_articles_share_token
ON research_chat.write_articles(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN research_chat.write_articles.share_token IS 'Token duy nhất cho link chia sẻ - ai có link (đã đăng nhập) có thể xem và chỉnh sửa';
