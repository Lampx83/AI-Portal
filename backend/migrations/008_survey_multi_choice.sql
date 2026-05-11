-- Migration 008: bổ sung loại câu hỏi multi_choice (chọn nhiều phương án)

ALTER TABLE ai_portal.survey_questions
  DROP CONSTRAINT IF EXISTS survey_questions_type_check;

ALTER TABLE ai_portal.survey_questions
  ADD CONSTRAINT survey_questions_type_check
  CHECK (type IN ('single_choice', 'multi_choice', 'text'));

COMMENT ON COLUMN ai_portal.survey_questions.type IS
'Loại câu hỏi: single_choice (chọn 1) | multi_choice (chọn nhiều) | text (gõ tự do). Với choice, mỗi option có thể có allow_text=true để cho phép gõ thêm khi chọn (vd "Khác").';

COMMENT ON COLUMN ai_portal.survey_responses.answers IS
'Map question_id -> answer. single_choice: { option: id, text? }. multi_choice: { options: id[], text? }. text: { text }.';
