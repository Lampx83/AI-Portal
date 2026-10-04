-- Migration 020: Vòng đời nghiên cứu của dự án (6 giai đoạn).
-- lifecycle = { version, currentStage, stages: [{ id, status, startedAt, doneAt, dueDate, note, checklist }] }
-- NULL = chưa có dữ liệu (giao diện tự hiển thị 6 giai đoạn «chưa bắt đầu»); không cần backfill.
ALTER TABLE ai_portal.projects ADD COLUMN IF NOT EXISTS lifecycle JSONB;
