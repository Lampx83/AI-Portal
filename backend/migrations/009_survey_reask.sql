-- Migration 009: Hỏi lại khảo sát định kỳ (re-ask)
-- Trước đây mỗi user/thiết bị chỉ trả lời 1 lần / khảo sát (unique index chặn trả lời lại).
-- Nay hỗ trợ "hỏi lại sau N ngày" (display_config.reask_days, mặc định 15) → cần cho phép
-- nhiều lượt trả lời theo thời gian. Bỏ 2 unique index; giữ lại index thường để truy vấn nhanh.

DROP INDEX IF EXISTS ai_portal.uq_survey_responses_user;
DROP INDEX IF EXISTS ai_portal.uq_survey_responses_guest;

-- Index thường (không unique) phục vụ truy vấn "lần trả lời gần nhất" trong /api/survey/active.
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_recent
  ON ai_portal.survey_responses(survey_id, user_id, submitted_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_guest_recent
  ON ai_portal.survey_responses(survey_id, guest_device_id, submitted_at DESC)
  WHERE guest_device_id IS NOT NULL;

COMMENT ON COLUMN ai_portal.surveys.display_config IS
'Cấu hình popup: { audience: all|logged_in|guest, trigger: { type: on_load|after_seconds|after_n_visits|on_exit_intent, value: number }, position: center|bottom_right|bottom_bar|top_bar, frequency: { type: once|once_per_n_days|until_answered|every_session, value: number }, reask_days: number (hỏi lại sau N ngày kể từ lần trả lời gần nhất; mặc định 15; 0 = không hỏi lại), dismissible: bool, max_dismissals: number, cooldown_days_after_dismiss: number, pages_include: string[], pages_exclude: string[] }';
