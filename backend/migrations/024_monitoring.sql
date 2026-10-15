-- Migration 024: Giám sát hệ thống (thống kê sử dụng, sức khoẻ dịch vụ, kiểm thử hồi quy Central, cảnh báo).
-- An toàn chạy lại (IF NOT EXISTS). Backend cũng tự gọi cùng các câu lệnh này lúc khởi động
-- (lib/monitoring/schema.ts) nên dù số phiên bản trùng với nhánh khác, bảng vẫn được tạo.
-- Số 024 cố ý chừa khoảng trống để tránh trùng số với các nhánh làm song song.

-- 1) Index cho truy vấn thống kê theo khoảng thời gian (messages/users chưa có index created_at).
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON ai_portal.messages (created_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON ai_portal.users (created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_submitted_at ON ai_portal.survey_responses (submitted_at);

-- 2) Kết quả kiểm tra sức khoẻ dịch vụ ngoài (lịch sử ngắn, tự dọn sau vài ngày).
CREATE TABLE IF NOT EXISTS ai_portal.service_health_checks (
  id          BIGSERIAL PRIMARY KEY,
  target_key  TEXT NOT NULL,
  target_name TEXT,
  url         TEXT,
  ok          BOOLEAN NOT NULL,
  status_code INTEGER,
  latency_ms  INTEGER,
  error       TEXT,
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_health_checks_target_time
  ON ai_portal.service_health_checks (target_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_health_checks_time
  ON ai_portal.service_health_checks (checked_at DESC);

-- 3) Kiểm thử hồi quy Trợ lý chính (Central). Không dùng agent_test_results vì bảng đó gắn
--    agent_id (FK assistants) + cột cố định cho metadata/data/ask, không chứa được ~50 câu có tiêu chí riêng.
CREATE TABLE IF NOT EXISTS ai_portal.central_regression_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger        TEXT NOT NULL DEFAULT 'manual',
  status         TEXT NOT NULL DEFAULT 'running',
  suite_version  TEXT,
  model          TEXT,
  total          INTEGER NOT NULL DEFAULT 0,
  completed      INTEGER NOT NULL DEFAULT 0,
  passed         INTEGER NOT NULL DEFAULT 0,
  score          NUMERIC(5,2),
  avg_latency_ms INTEGER,
  triggered_by   TEXT,
  run_date       DATE,
  error          TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_central_regression_runs_started
  ON ai_portal.central_regression_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS ai_portal.central_regression_results (
  id               BIGSERIAL PRIMARY KEY,
  run_id           UUID NOT NULL REFERENCES ai_portal.central_regression_runs(id) ON DELETE CASCADE,
  case_id          TEXT NOT NULL,
  category         TEXT,
  question         TEXT,
  passed           BOOLEAN NOT NULL DEFAULT false,
  score            NUMERIC(5,2),
  latency_ms       INTEGER,
  functions_called JSONB,
  checks           JSONB,
  answer           TEXT,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_central_regression_results_run
  ON ai_portal.central_regression_results (run_id);

-- 4) Trạng thái nội bộ của tác vụ nền (khoá thuê/lease để nhiều tiến trình backend không chạy trùng).
CREATE TABLE IF NOT EXISTS ai_portal.monitoring_state (
  key        TEXT PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
