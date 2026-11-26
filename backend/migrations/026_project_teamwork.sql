-- Migration 026: Làm việc nhóm trong Dự án (vai trò thành viên, tên tệp, nhật ký hoạt động).
-- Idempotent. Backend cũng tự tạo (lib/project-access.ts → ensureProjectTeamwork) phòng khi migration chưa chạy.
--
-- member_roles: { "<email chữ thường>": "editor" | "viewer" }. Thiếu khoá = "viewer" (giữ đúng hành vi cũ: thành viên chỉ xem).
-- file_meta:    { "<khoá MinIO>": { name, size, mime, folder, by, at } }. Tệp cũ không có mục → giao diện hiện «Tệp cũ».
ALTER TABLE ai_portal.projects ADD COLUMN IF NOT EXISTS member_roles JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE ai_portal.projects ADD COLUMN IF NOT EXISTS file_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ai_portal.project_activity (
  id          BIGSERIAL PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES ai_portal.projects(id) ON DELETE CASCADE,
  actor_email TEXT,
  kind        TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_activity_project ON ai_portal.project_activity (project_id, created_at DESC);

-- Email thành viên luôn chữ thường (trước đây so khớp phân biệt hoa/thường nên người được mời có thể không thấy dự án).
UPDATE ai_portal.projects
   SET team_members = COALESCE(
         (SELECT jsonb_agg(DISTINCT lower(btrim(m))) FROM jsonb_array_elements_text(team_members) AS m WHERE btrim(m) <> ''),
         '[]'::jsonb)
 WHERE jsonb_typeof(team_members) = 'array'
   AND team_members::text <> lower(team_members::text);
