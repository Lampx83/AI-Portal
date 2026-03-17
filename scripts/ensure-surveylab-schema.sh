#!/bin/bash
# Tạo schema Surveylab trong data/apps/surveylab (chạy khi thiếu schema sau khi cài lại).
# Dùng khi backend báo: schema/schema.sql not found, relation "surveylab.surveys" does not exist.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SURVEYLAB_APP="$PORTAL_ROOT/backend/data/apps/surveylab"
# Nguồn schema: từ repo Tools (cùng workspace với AI-Portal) hoặc dùng bản nhúng bên dưới
SRC_SCHEMA="${SURVEYLAB_SCHEMA_SRC:-$PORTAL_ROOT/../Tools/NEU/Research/Surveylab/backend/schema/schema.sql}"

if [ ! -f "$SRC_SCHEMA" ]; then
  echo "Nguồn schema không tìm thấy: $SRC_SCHEMA"
  echo "Đang dùng schema nhúng trong script..."
  mkdir -p "$SURVEYLAB_APP/schema"
  cat > "$SURVEYLAB_APP/schema/schema.sql" << 'SQLEOF'
-- Surveylab: __SCHEMA__ được thay bằng tên schema (ví dụ "surveylab") khi chạy
CREATE SCHEMA IF NOT EXISTS __SCHEMA__;

CREATE TABLE IF NOT EXISTS __SCHEMA__.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT,
  sso_provider TEXT,
  sso_sub TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_surveylab_users_sso_unique ON __SCHEMA__.users(sso_provider, sso_sub) WHERE sso_provider IS NOT NULL AND sso_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS __SCHEMA__.surveys (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES __SCHEMA__.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]',
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.responses (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS __SCHEMA__.share_links (
  short_id VARCHAR(6) PRIMARY KEY,
  survey_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surveylab_users_email ON __SCHEMA__.users(email);
CREATE INDEX IF NOT EXISTS idx_surveylab_users_sso ON __SCHEMA__.users(sso_provider, sso_sub);
CREATE INDEX IF NOT EXISTS idx_surveylab_surveys_user_id ON __SCHEMA__.surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveylab_responses_survey_id ON __SCHEMA__.responses(survey_id);
SQLEOF
else
  mkdir -p "$SURVEYLAB_APP/schema"
  cp "$SRC_SCHEMA" "$SURVEYLAB_APP/schema/schema.sql"
fi
echo "Đã tạo/cập nhật: $SURVEYLAB_APP/schema/schema.sql"
ls -la "$SURVEYLAB_APP/schema/"
