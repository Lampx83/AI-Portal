-- BiblioMap: schema khi nhúng trong AI Portal. FK tham chiếu ai_portal.users.
-- Chạy tay khi cài app hoặc dùng schema/portal-embedded.sql.

CREATE SCHEMA IF NOT EXISTS bibliomap;

CREATE TABLE IF NOT EXISTS bibliomap.bibliomap_projects (
  id          TEXT NOT NULL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topic       TEXT NOT NULL DEFAULT '',
  year_from   INTEGER NOT NULL,
  year_to     INTEGER NOT NULL,
  doc_types   TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bibliomap_projects_user_id ON bibliomap.bibliomap_projects(user_id);

CREATE TABLE IF NOT EXISTS bibliomap.bibliomap_papers (
  id          TEXT NOT NULL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  authors     TEXT[] NOT NULL DEFAULT '{}',
  year        INTEGER NOT NULL,
  source      TEXT,
  journal     TEXT,
  volume      TEXT,
  issue       TEXT,
  pages       TEXT,
  doi         TEXT,
  abstract    TEXT,
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  citations   INTEGER NOT NULL DEFAULT 0,
  references  TEXT[] NOT NULL DEFAULT '{}',
  ref_ids     TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bibliomap_papers_user_id ON bibliomap.bibliomap_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_bibliomap_papers_project_id ON bibliomap.bibliomap_papers(project_id);

CREATE TABLE IF NOT EXISTS bibliomap.bibliomap_maps (
  id               TEXT NOT NULL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  project_id       TEXT NOT NULL,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('co-authorship', 'co-citation', 'bibliographic-coupling', 'keyword-cooccurrence', 'institution')),
  min_links        INTEGER,
  min_occurrences  INTEGER,
  year_from        INTEGER,
  year_to          INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bibliomap_maps_user_id ON bibliomap.bibliomap_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_bibliomap_maps_project_id ON bibliomap.bibliomap_maps(project_id);

CREATE TABLE IF NOT EXISTS bibliomap.bibliomap_map_data (
  map_id   TEXT NOT NULL PRIMARY KEY REFERENCES bibliomap.bibliomap_maps(id) ON DELETE CASCADE,
  nodes    JSONB NOT NULL DEFAULT '[]',
  links    JSONB NOT NULL DEFAULT '[]'
);
