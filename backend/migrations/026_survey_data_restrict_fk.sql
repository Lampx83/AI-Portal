-- Migration 026: chặn mất dữ liệu khảo sát (P0)
-- Trước đây survey_responses / survey_impressions có FK survey_id ... ON DELETE CASCADE:
-- một lệnh DELETE FROM surveys (seed chạy lại, nút Xoá khảo sát, thao tác tay) xoá luôn toàn bộ phản hồi.
-- Nay đổi sang RESTRICT: không xoá được khảo sát đang có phản hồi/impression; phải xuất dữ liệu rồi
-- chủ động xoá phản hồi (DELETE /api/admin/surveys/:id/responses) hoặc dùng is_active=false để ẩn khảo sát.
-- survey_questions vẫn CASCADE: khảo sát có phản hồi thì lệnh xoá bị chặn ngay ở survey_responses, nên
-- câu hỏi không bị xoá theo. Migration idempotent, không đụng dữ liệu.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, cl.relname AS tbl
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'ai_portal'
      AND cl.relname IN ('survey_responses', 'survey_impressions')
      AND c.contype = 'f'
      AND c.confrelid = 'ai_portal.surveys'::regclass
      AND c.confdeltype <> 'r'   -- 'r' = RESTRICT; bỏ qua nếu đã đúng
  LOOP
    EXECUTE format('ALTER TABLE ai_portal.%I DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE ai_portal.%I ADD CONSTRAINT %I FOREIGN KEY (survey_id) REFERENCES ai_portal.surveys(id) ON DELETE RESTRICT',
      r.tbl, r.conname
    );
    RAISE NOTICE '026: % . % -> ON DELETE RESTRICT', r.tbl, r.conname;
  END LOOP;
END $$;
