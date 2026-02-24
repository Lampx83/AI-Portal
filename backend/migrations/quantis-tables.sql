-- Quantis: schema riêng khi dùng trong AI Portal. FK tham chiếu ai_portal.users.
-- Chạy tay khi cần (hoặc khi cài app Quantis từ zip). Cần có ai_portal.users trước.

CREATE SCHEMA IF NOT EXISTS quantis;

-- Bảng dataset: metadata + preview + full data (JSONB)
CREATE TABLE IF NOT EXISTS quantis.quantis_datasets (
  id          TEXT NOT NULL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rows        INTEGER NOT NULL DEFAULT 0,
  columns     INTEGER NOT NULL DEFAULT 0,
  column_names JSONB NOT NULL DEFAULT '[]',
  preview     JSONB NOT NULL DEFAULT '[]',
  data        JSONB,
  source_format TEXT NOT NULL DEFAULT 'csv',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quantis_datasets_user_id ON quantis.quantis_datasets(user_id);
CREATE INDEX IF NOT EXISTS idx_quantis_datasets_updated_at ON quantis.quantis_datasets(updated_at DESC);

-- Bảng workflow: tên, mô tả, dataset_id, steps (JSONB)
CREATE TABLE IF NOT EXISTS quantis.quantis_workflows (
  id          TEXT NOT NULL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  dataset_id  TEXT,
  steps       JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quantis_workflows_user_id ON quantis.quantis_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_quantis_workflows_updated_at ON quantis.quantis_workflows(updated_at DESC);
