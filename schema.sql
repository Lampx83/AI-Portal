-- 1. Extension & Schema
-- Note: Database is created automatically by POSTGRES_DB environment variable
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS research_chat;

-- 3. Enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='message_role') THEN
    CREATE TYPE message_role AS ENUM ('user','assistant','system','tool','orchestrator');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='message_status') THEN
    CREATE TYPE message_status AS ENUM ('ok','partial','error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='content_type') THEN
    CREATE TYPE content_type AS ENUM ('text','markdown','json','code');
  END IF;
END$$;

-- 4. Bảng users (có mật khẩu & SSO)
CREATE TABLE research_chat.users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                CITEXT UNIQUE NOT NULL,
  display_name         TEXT,
  password_hash        TEXT,
  password_algo        TEXT,
  password_updated_at  TIMESTAMPTZ,
  sso_provider         TEXT,
  sso_subject          TEXT,
  azure_tenant_id      TEXT,
  email_verified_at    TIMESTAMPTZ,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_users_sso UNIQUE (sso_provider, sso_subject)
);

-- 4.1. Tạo system user mặc định (cho anonymous sessions)
INSERT INTO research_chat.users (id, email, display_name, created_at, updated_at)
SELECT 
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system@research.local',
  'System User',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM research_chat.users WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
);

-- 5. Bảng chat_sessions
CREATE TABLE research_chat.chat_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES research_chat.users(id) ON DELETE CASCADE,
  assistant_alias  TEXT NOT NULL,
  title            TEXT,
  model_id         TEXT,
  model_meta       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count    INT NOT NULL DEFAULT 0,
  last_message_at  TIMESTAMPTZ
);

-- 6. Bảng messages
CREATE TABLE research_chat.messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES research_chat.chat_sessions(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES research_chat.users(id) ON DELETE SET NULL,
  assistant_alias    TEXT,
  role               message_role NOT NULL,
  status             message_status NOT NULL DEFAULT 'ok',
  content_type       content_type NOT NULL DEFAULT 'markdown',
  content            TEXT,
  content_json       JSONB,
  model_id           TEXT,
  response_time_ms   INTEGER,
  prompt_tokens      INTEGER,
  completion_tokens  INTEGER,
  total_tokens        INTEGER,
  refs         JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Bảng message_attachments
CREATE TABLE research_chat.message_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    UUID NOT NULL REFERENCES research_chat.messages(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  mime_type     TEXT,
  byte_size     BIGINT,
  extra_meta    JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Indexes
CREATE INDEX idx_sessions_user ON research_chat.chat_sessions(user_id);
CREATE INDEX idx_sessions_alias ON research_chat.chat_sessions(assistant_alias);
CREATE INDEX idx_sessions_updated_at ON research_chat.chat_sessions(updated_at DESC);

CREATE INDEX idx_messages_session_created ON research_chat.messages(session_id, created_at);
CREATE INDEX idx_messages_role ON research_chat.messages(role);
CREATE INDEX idx_messages_alias ON research_chat.messages(assistant_alias);
CREATE INDEX idx_messages_content_json_gin ON research_chat.messages USING GIN (content_json);
CREATE INDEX idx_messages_refs_gin ON research_chat.messages USING GIN (refs);


-- 9. Full-text search cho messages
ALTER TABLE research_chat.messages
  ADD COLUMN content_tsv tsvector;

CREATE INDEX idx_messages_tsv ON research_chat.messages USING GIN (content_tsv);

CREATE OR REPLACE FUNCTION research_chat.messages_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.content,'')), 'A')
    || setweight(to_tsvector('simple', coalesce(NEW.content_json::text,'')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_tsv
BEFORE INSERT OR UPDATE OF content, content_json
ON research_chat.messages
FOR EACH ROW EXECUTE FUNCTION research_chat.messages_tsv_update();

-- 10. Trigger cập nhật thống kê session
CREATE OR REPLACE FUNCTION research_chat.bump_session_stats() RETURNS trigger AS $$
BEGIN
  UPDATE research_chat.chat_sessions
     SET message_count   = message_count + 1,
         last_message_at = NEW.created_at,
         updated_at      = NEW.created_at
   WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_stats
AFTER INSERT ON research_chat.messages
FOR EACH ROW EXECUTE FUNCTION research_chat.bump_session_stats();
