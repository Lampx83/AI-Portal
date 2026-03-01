-- Migration 002: Bảng theo dõi phiên bản schema (phiên bản 2)
-- Chạy khi ai_portal đã tồn tại (sau init hoặc restore).
-- Migration runner sẽ INSERT version sau khi chạy file này thành công.
CREATE TABLE IF NOT EXISTS ai_portal.schema_version (
  version INT NOT NULL PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
