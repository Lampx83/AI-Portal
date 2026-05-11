-- Migration 006: bổ sung loại câu hỏi cho khảo sát
-- - single_choice: chọn 1 phương án (mặc định cũ). Mỗi option có thể bật allow_text để cho phép gõ thêm.
-- - text: câu trả lời tự do, không có phương án.

ALTER TABLE ai_portal.survey_questions
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'single_choice';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'survey_questions_type_check'
  ) THEN
    ALTER TABLE ai_portal.survey_questions
      ADD CONSTRAINT survey_questions_type_check
      CHECK (type IN ('single_choice', 'text'));
  END IF;
END$$;

COMMENT ON COLUMN ai_portal.survey_questions.type IS
'Loại câu hỏi: single_choice (chọn 1) | text (gõ tự do). Với single_choice, mỗi option có thể có allow_text=true để cho phép gõ thêm khi chọn (vd "Khác").';

COMMENT ON COLUMN ai_portal.survey_questions.options IS
'Mảng lựa chọn (chỉ áp dụng cho type=single_choice): [{ "id": "...", "label": "...", "allow_text": true|false }]. Với type=text, options = [].';

COMMENT ON COLUMN ai_portal.survey_responses.answers IS
'Map question_id -> { option?: string, text?: string }. single_choice: {option}; nếu chọn option allow_text thì có thêm {text}. text: {text}.';
