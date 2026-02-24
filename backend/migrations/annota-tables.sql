-- Annota: schema riêng khi dùng trong AI Portal. FK tham chiếu ai_portal.users.
-- Chạy tay nếu cần (hoặc khi cài app từ zip sẽ chạy schema/portal-embedded.sql).

CREATE SCHEMA IF NOT EXISTS annota;

CREATE TABLE IF NOT EXISTS annota.annota_folders (
  id        TEXT NOT NULL PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  parent_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_annota_folders_user_id ON annota.annota_folders(user_id);

CREATE TABLE IF NOT EXISTS annota.annota_sources (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  folder_id  TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}',
  type       TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'pdf')),
  file_key   TEXT,
  file_name  TEXT,
  file_size  BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_annota_sources_user_id ON annota.annota_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_annota_sources_folder_id ON annota.annota_sources(folder_id);

CREATE TABLE IF NOT EXISTS annota.annota_nodes (
  id          TEXT NOT NULL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  parent_id   TEXT,
  description TEXT,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_annota_nodes_user_id ON annota.annota_nodes(user_id);

CREATE TABLE IF NOT EXISTS annota.annota_codes (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  source_id  TEXT NOT NULL,
  node_id    TEXT NOT NULL,
  start      INTEGER NOT NULL,
  "end"      INTEGER NOT NULL,
  excerpt    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  weight     NUMERIC,
  coder_id   TEXT,
  flag       TEXT CHECK (flag IS NULL OR flag IN ('key_quote', 'negative_case'))
);
CREATE INDEX IF NOT EXISTS idx_annota_codes_user_id ON annota.annota_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_annota_codes_source_id ON annota.annota_codes(source_id);
CREATE INDEX IF NOT EXISTS idx_annota_codes_node_id ON annota.annota_codes(node_id);

CREATE TABLE IF NOT EXISTS annota.annota_memos (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  source_id  TEXT,
  node_id    TEXT,
  memo_type  TEXT NOT NULL DEFAULT 'memo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_annota_memos_user_id ON annota.annota_memos(user_id);

CREATE TABLE IF NOT EXISTS annota.annota_annotations (
  id         TEXT NOT NULL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  source_id  TEXT NOT NULL,
  start      INTEGER NOT NULL,
  "end"      INTEGER NOT NULL,
  excerpt    TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_annota_annotations_user_id ON annota.annota_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annota_annotations_source_id ON annota.annota_annotations(source_id);
