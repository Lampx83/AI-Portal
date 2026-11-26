-- Migration 025: Token cho ứng dụng máy tính NEU Research (giai đoạn 2) + nhật ký sử dụng tối thiểu.
-- An toàn chạy lại (IF NOT EXISTS). Backend cũng tự tạo các bảng này khi dùng lần đầu
-- (lib/desktop/schema.ts), nên dù số phiên bản trùng nhánh khác, bảng vẫn có.
--
-- Không lưu token gốc: chỉ lưu SHA-256 của access token và refresh token.
-- Nhật ký sử dụng KHÔNG chứa nội dung hội thoại hay nội dung tệp của người dùng.

CREATE TABLE IF NOT EXISTS ai_portal.desktop_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES ai_portal.users(id) ON DELETE CASCADE,
  device_name         TEXT,
  platform            TEXT,
  app_version         TEXT,
  access_hash         TEXT NOT NULL UNIQUE,
  access_expires_at   TIMESTAMPTZ NOT NULL,
  refresh_hash        TEXT NOT NULL UNIQUE,
  refresh_expires_at  TIMESTAMPTZ NOT NULL,
  -- refresh token liền trước (đã xoay vòng). Nếu ai đó dùng lại nó → coi như bị lộ, thu hồi cả phiên.
  prev_refresh_hash   TEXT,
  -- hạn tuyệt đối của phiên thiết bị (không gia hạn quá mốc này).
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at        TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  revoked_reason      TEXT
);
CREATE INDEX IF NOT EXISTS idx_desktop_tokens_user ON ai_portal.desktop_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_desktop_tokens_prev_refresh ON ai_portal.desktop_tokens (prev_refresh_hash);

CREATE TABLE IF NOT EXISTS ai_portal.desktop_usage (
  id                BIGSERIAL PRIMARY KEY,
  user_id           UUID NOT NULL,
  token_id          UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  model             TEXT,
  status            TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  input_chars       INTEGER NOT NULL DEFAULT 0,
  tool_calls        INTEGER NOT NULL DEFAULT 0,
  duration_ms       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_desktop_usage_user_time ON ai_portal.desktop_usage (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_desktop_usage_time ON ai_portal.desktop_usage (created_at DESC);
