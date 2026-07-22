-- 013: Đổi model Central trên instance Research sang 'gpt-oss:20b'.
-- Lý do: qwen3:8b là model "reasoning", sinh rất nhiều token suy luận ở bước pass-1 (buffered, khi có
-- function tools) → vượt timeout nginx 60s → lỗi 504 ngay cả với câu chào. gpt-oss:20b trả lời nhanh
-- (~5s), tiếng Việt tốt, hỗ trợ function-calling → phù hợp cho trợ lý tương tác.
-- CHỈ áp dụng instance Research; no-op nơi khác. Ghi đè model đã set ở migration 011.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '013_research_central_model: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', 'gpt-oss:20b')
  ON CONFLICT (key) DO UPDATE SET value = 'gpt-oss:20b'
    WHERE ai_portal.app_settings.value IN ('', 'qwen3:8b');

  RAISE NOTICE '013_research_central_model: đã đổi model Central sang gpt-oss:20b cho instance Research.';
END $$;
