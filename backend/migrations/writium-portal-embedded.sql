-- Writium trên AI Portal: chạy tay một lần nếu đã cài gói cũ (portal-embedded.sql lỗi __SCHEMA__).
-- psql $DATABASE_URL -f migrations/writium-portal-embedded.sql
-- Yêu cầu: bảng ai_portal.users (và ai_portal.projects cho FK project_id).

CREATE SCHEMA IF NOT EXISTS writium;

CREATE TABLE IF NOT EXISTS writium.write_articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES ai_portal.projects(id) ON DELETE SET NULL,
  title           TEXT NOT NULL DEFAULT 'Untitled document',
  content         TEXT NOT NULL DEFAULT '',
  template_id     TEXT,
  references_json JSONB NOT NULL DEFAULT '[]',
  share_token     TEXT UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_write_articles_embed_user_id ON writium.write_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_write_articles_embed_updated_at ON writium.write_articles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_write_articles_embed_project_id ON writium.write_articles(project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_write_articles_embed_share_token ON writium.write_articles(share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS writium.write_article_comments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       UUID NOT NULL REFERENCES writium.write_articles(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  author_display   TEXT NOT NULL DEFAULT '',
  content          TEXT NOT NULL DEFAULT '',
  parent_id        UUID REFERENCES writium.write_article_comments(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_write_article_comments_embed_article_id ON writium.write_article_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_write_article_comments_embed_parent_id ON writium.write_article_comments(parent_id);

CREATE TABLE IF NOT EXISTS writium.write_article_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      UUID NOT NULL REFERENCES writium.write_articles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  references_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_write_article_versions_embed_article_id ON writium.write_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_write_article_versions_embed_created_at ON writium.write_article_versions(article_id, created_at DESC);
