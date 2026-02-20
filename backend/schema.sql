-- =============================================================================
-- AI Portal – Schema khởi tạo database
-- Schema này được áp dụng khi người dùng đã chọn tên database (bước init-database
-- trong quy trình cài đặt). Toàn bộ đối tượng nằm trong schema ai_portal.
-- =============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 2. Schema
CREATE SCHEMA IF NOT EXISTS ai_portal;

-- 3. Enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system', 'tool', 'orchestrator');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE message_status AS ENUM ('ok', 'partial', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
    CREATE TYPE content_type AS ENUM ('text', 'markdown', 'json', 'code');
  END IF;
END$$;

-- 4. Bảng users
CREATE TABLE ai_portal.users (
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
  is_admin             BOOLEAN NOT NULL DEFAULT false,
  role                 TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'developer')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name            TEXT,
  position             TEXT,
  department_id        UUID,
  intro                TEXT,
  direction            JSONB,
  google_scholar_url   TEXT,
  academic_title       TEXT,
  academic_degree      TEXT,
  settings_json        JSONB NOT NULL DEFAULT '{}',
  daily_message_limit  INTEGER NOT NULL DEFAULT 10,
  CONSTRAINT uq_users_sso UNIQUE (sso_provider, sso_subject)
);

COMMENT ON COLUMN ai_portal.users.role IS 'Quyền: user, admin, developer';
COMMENT ON COLUMN ai_portal.users.direction IS 'Định hướng / lĩnh vực (mảng chuỗi)';
COMMENT ON COLUMN ai_portal.users.settings_json IS 'User preferences: language, notifications, privacy, ai, data';
COMMENT ON COLUMN ai_portal.users.daily_message_limit IS 'Số tin nhắn tối đa mỗi user mỗi ngày';

-- 5. Bảng Đơn vị / Phòng ban (dùng trong hồ sơ người dùng; không gắn với trường học)
CREATE TABLE ai_portal.departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_departments_display_order ON ai_portal.departments(display_order);

ALTER TABLE ai_portal.users
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES ai_portal.departments(id) ON DELETE SET NULL;

-- 6. User hệ thống và khách (seed)
INSERT INTO ai_portal.users (id, email, display_name, created_at, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system@portal.local',
  'System User',
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM ai_portal.users WHERE id = '00000000-0000-0000-0000-000000000000'::uuid);

INSERT INTO ai_portal.users (id, email, display_name, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'guest@portal.local',
  'Khách',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();

-- 7. (Không seed departments – quản trị viên thêm đơn vị/phòng ban theo nhu cầu tổ chức.)

-- 8. Trợ lý AI (assistants)
CREATE TABLE ai_portal.assistants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias        TEXT NOT NULL UNIQUE,
  icon         TEXT NOT NULL DEFAULT 'Bot',
  base_url     TEXT NOT NULL,
  domain_url   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  config_json  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assistants_alias ON ai_portal.assistants(alias);
CREATE INDEX IF NOT EXISTS idx_assistants_active ON ai_portal.assistants(is_active, display_order);

-- 8a. Công cụ (tools): data — tách khỏi bảng assistants để phân biệt trợ lý vs công cụ
CREATE TABLE ai_portal.tools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias         TEXT NOT NULL UNIQUE,
  icon          TEXT NOT NULL DEFAULT 'Bot',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  config_json   JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tools_alias ON ai_portal.tools(alias);
CREATE INDEX IF NOT EXISTS idx_tools_active ON ai_portal.tools(is_active, display_order);

-- 8b. Shortcuts (link công cụ trực tuyến — chỉ lưu link, hệ thống không quản lý)
CREATE TABLE ai_portal.shortcuts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  url           TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT 'ExternalLink',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shortcuts_display_order ON ai_portal.shortcuts(display_order);

-- 9. Dự án (projects)
CREATE TABLE ai_portal.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  team_members JSONB NOT NULL DEFAULT '[]',
  file_keys   JSONB NOT NULL DEFAULT '[]',
  tags        TEXT[] DEFAULT '{}',
  icon        TEXT DEFAULT 'FolderKanban',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON ai_portal.projects(user_id);

-- 10. Phiên chat
CREATE TABLE ai_portal.chat_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  assistant_alias  TEXT NOT NULL,
  project_id       UUID REFERENCES ai_portal.projects(id) ON DELETE SET NULL,
  title            TEXT,
  model_id         TEXT,
  model_meta       JSONB,
  source           TEXT NOT NULL DEFAULT 'web',
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count    INT NOT NULL DEFAULT 0,
  last_message_at  TIMESTAMPTZ
);
COMMENT ON COLUMN ai_portal.chat_sessions.project_id IS 'Dự án gắn với phiên chat; NULL = chat chung';
COMMENT ON COLUMN ai_portal.chat_sessions.source IS 'web | embed';
CREATE INDEX IF NOT EXISTS idx_sessions_user ON ai_portal.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_alias ON ai_portal.chat_sessions(assistant_alias);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON ai_portal.chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_source ON ai_portal.chat_sessions(source);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON ai_portal.chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_deleted_at ON ai_portal.chat_sessions(deleted_at) WHERE deleted_at IS NULL;

-- 11. Tin nhắn
CREATE TABLE ai_portal.messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES ai_portal.chat_sessions(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
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
  total_tokens       INTEGER,
  refs               JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON ai_portal.messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON ai_portal.messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_alias ON ai_portal.messages(assistant_alias);
CREATE INDEX IF NOT EXISTS idx_messages_content_json_gin ON ai_portal.messages USING GIN (content_json);
CREATE INDEX IF NOT EXISTS idx_messages_refs_gin ON ai_portal.messages USING GIN (refs);

-- 12. Full-text search cho messages
ALTER TABLE ai_portal.messages ADD COLUMN IF NOT EXISTS content_tsv tsvector;
CREATE INDEX IF NOT EXISTS idx_messages_tsv ON ai_portal.messages USING GIN (content_tsv);

CREATE OR REPLACE FUNCTION ai_portal.messages_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.content, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(NEW.content_json::text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_tsv ON ai_portal.messages;
CREATE TRIGGER trg_messages_tsv
  BEFORE INSERT OR UPDATE OF content, content_json ON ai_portal.messages
  FOR EACH ROW EXECUTE FUNCTION ai_portal.messages_tsv_update();

-- 13. Trigger cập nhật thống kê session
CREATE OR REPLACE FUNCTION ai_portal.bump_session_stats() RETURNS trigger AS $$
BEGIN
  UPDATE ai_portal.chat_sessions
  SET message_count = message_count + 1,
      last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_stats ON ai_portal.messages;
CREATE TRIGGER trg_messages_stats
  AFTER INSERT ON ai_portal.messages
  FOR EACH ROW EXECUTE FUNCTION ai_portal.bump_session_stats();

-- 14. Đính kèm file tin nhắn
CREATE TABLE ai_portal.message_attachments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES ai_portal.messages(id) ON DELETE CASCADE,
  file_url   TEXT NOT NULL,
  file_name  TEXT,
  mime_type  TEXT,
  byte_size  BIGINT,
  extra_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Xoá bảng write (nếu tồn tại từ lần cài Write App trước)
DROP TABLE IF EXISTS ai_portal.write_article_comments;
DROP TABLE IF EXISTS ai_portal.write_article_versions;
DROP TABLE IF EXISTS ai_portal.write_articles;

-- 16. Override giới hạn tin nhắn theo ngày (admin)
CREATE TABLE ai_portal.user_daily_limit_overrides (
  user_id       UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  override_date DATE NOT NULL DEFAULT current_date,
  extra_messages INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, override_date)
);
CREATE INDEX IF NOT EXISTS idx_user_daily_limit_overrides_date ON ai_portal.user_daily_limit_overrides(override_date);

-- 18. Đếm tin nhắn đã gửi mỗi ngày (quota)
CREATE TABLE ai_portal.user_daily_message_sends (
  user_id   UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  send_date DATE NOT NULL DEFAULT current_date,
  count     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, send_date)
);
CREATE INDEX IF NOT EXISTS idx_user_daily_message_sends_date ON ai_portal.user_daily_message_sends(send_date);

-- 19. Lịch sử đăng nhập
CREATE TABLE ai_portal.login_events (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_events_login_at ON ai_portal.login_events(login_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_user_id ON ai_portal.login_events(user_id);

-- 21. Thông báo (system, portal_invite = AI Portal invite)
CREATE TABLE ai_portal.notifications (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  type      TEXT NOT NULL DEFAULT 'system',
  title     TEXT NOT NULL,
  body      TEXT,
  payload   JSONB NOT NULL DEFAULT '{}',
  read_at   TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON COLUMN ai_portal.notifications.payload IS 'Ví dụ portal_invite: { project_id, project_name, inviter_email, inviter_name }';
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON ai_portal.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON ai_portal.notifications(created_at DESC);

-- 22. Giới hạn dùng thử khách (theo thiết bị/trợ lý/ngày)
CREATE TABLE ai_portal.guest_device_daily_usage (
  device_id       TEXT NOT NULL,
  assistant_alias TEXT NOT NULL,
  usage_date      DATE NOT NULL DEFAULT current_date,
  message_count   INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, assistant_alias, usage_date)
);
CREATE TABLE ai_portal.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
INSERT INTO ai_portal.app_settings (key, value) VALUES ('guest_daily_message_limit', '1')
ON CONFLICT (key) DO NOTHING;

-- 23. Phản hồi like/dislike tin nhắn
CREATE TABLE ai_portal.message_feedback (
  message_id  UUID NOT NULL REFERENCES ai_portal.messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  feedback    TEXT NOT NULL CHECK (feedback IN ('like', 'dislike')),
  comment     TEXT,
  admin_note  TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON ai_portal.message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_feedback ON ai_portal.message_feedback(feedback);

-- 24. Góp ý người dùng về hệ thống
CREATE TABLE ai_portal.user_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  assistant_alias TEXT,
  admin_note      TEXT,
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON ai_portal.user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_assistant_alias ON ai_portal.user_feedback(assistant_alias);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON ai_portal.user_feedback(created_at DESC);

-- 25. Test agents (Admin)
CREATE TABLE ai_portal.agent_test_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_agents  INTEGER NOT NULL DEFAULT 0,
  passed_count  INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ai_portal.agent_test_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id              UUID NOT NULL REFERENCES ai_portal.agent_test_runs(id) ON DELETE CASCADE,
  agent_id            UUID NOT NULL REFERENCES ai_portal.assistants(id) ON DELETE CASCADE,
  agent_alias         TEXT NOT NULL,
  base_url            TEXT,
  metadata_pass       BOOLEAN,
  data_documents_pass BOOLEAN,
  data_experts_pass   BOOLEAN,
  ask_text_pass       BOOLEAN,
  ask_file_pass       BOOLEAN,
  metadata_ms         INTEGER,
  data_documents_ms   INTEGER,
  data_experts_ms     INTEGER,
  ask_text_ms         INTEGER,
  ask_file_ms         INTEGER,
  data_details        JSONB,
  ask_text_details    JSONB,
  ask_file_details    JSONB,
  metadata_details    JSONB,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_test_results_run_id ON ai_portal.agent_test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_results_agent_id ON ai_portal.agent_test_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_run_at ON ai_portal.agent_test_runs(run_at DESC);

-- 26. Chuỗi hiển thị: theo gói ngôn ngữ (data/locales/{locale}.json), không lưu trong DB. Xem backend/src/lib/locale-packages.ts.

-- 27. Công bố (publications)
CREATE TABLE ai_portal.publications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  authors    JSONB NOT NULL DEFAULT '[]',
  journal    TEXT,
  year       INTEGER,
  type       TEXT CHECK (type IN ('journal', 'conference', 'book', 'thesis')),
  status     TEXT CHECK (status IN ('published', 'accepted', 'submitted', 'draft')),
  doi        TEXT,
  abstract   TEXT,
  file_keys  JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_publications_user_id ON ai_portal.publications(user_id);
