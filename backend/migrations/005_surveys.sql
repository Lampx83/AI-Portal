-- Migration 005: Khảo sát popup
-- Bảng khảo sát + câu hỏi (single_choice) + cấu hình hiển thị + lưu câu trả lời + log impression.

CREATE TABLE IF NOT EXISTS ai_portal.surveys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT false,
  priority     INTEGER NOT NULL DEFAULT 0,
  start_at     TIMESTAMPTZ,
  end_at       TIMESTAMPTZ,
  thank_you_message TEXT,
  -- Cấu hình hiển thị / tần suất gộp vào JSONB cho linh hoạt
  display_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_surveys_active ON ai_portal.surveys(is_active, priority DESC);

COMMENT ON COLUMN ai_portal.surveys.display_config IS
'Cấu hình popup: { audience: all|logged_in|guest, trigger: { type: on_load|after_seconds|after_n_visits|on_exit_intent, value: number }, position: center|bottom_right|bottom_bar|top_bar, frequency: { type: once|once_per_n_days|until_answered|every_session, value: number }, dismissible: bool, max_dismissals: number, cooldown_days_after_dismiss: number, pages_include: string[], pages_exclude: string[] }';

CREATE TABLE IF NOT EXISTS ai_portal.survey_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id   UUID NOT NULL REFERENCES ai_portal.surveys(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  options     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON ai_portal.survey_questions(survey_id, order_index);

COMMENT ON COLUMN ai_portal.survey_questions.options IS
'Mảng lựa chọn single_choice: [{ "id": "uuid|slug", "label": "..." }]';

CREATE TABLE IF NOT EXISTS ai_portal.survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES ai_portal.surveys(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
  guest_device_id TEXT,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_agent      TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON ai_portal.survey_responses(survey_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user ON ai_portal.survey_responses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_guest ON ai_portal.survey_responses(guest_device_id) WHERE guest_device_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_survey_responses_user ON ai_portal.survey_responses(survey_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_survey_responses_guest ON ai_portal.survey_responses(survey_id, guest_device_id) WHERE guest_device_id IS NOT NULL;

COMMENT ON COLUMN ai_portal.survey_responses.answers IS
'Map question_id -> option_id (single_choice). Vd: {"q1": "opt_a"}';

CREATE TABLE IF NOT EXISTS ai_portal.survey_impressions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES ai_portal.surveys(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES ai_portal.users(id) ON DELETE SET NULL,
  guest_device_id TEXT,
  event           TEXT NOT NULL CHECK (event IN ('shown', 'dismissed', 'completed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_impr_survey_user ON ai_portal.survey_impressions(survey_id, user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_impr_survey_guest ON ai_portal.survey_impressions(survey_id, guest_device_id, created_at DESC) WHERE guest_device_id IS NOT NULL;
