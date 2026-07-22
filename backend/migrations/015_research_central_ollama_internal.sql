-- 015: Bật lại Central trên Research, trỏ tới Ollama NỘI BỘ (dc_ollama/ollama trên server .232).
-- Địa chỉ container backend (.223) gọi được: http://10.2.13.58:11434 (đã kiểm chứng /v1/models có
-- gpt-oss:20b, chat completion OK; cùng mạng 10.2.13.x mà backend đã gọi các agent khác 10.2.13.54/58).
-- Khác migration 011 (dùng URL công khai research.neu.edu.vn/ollama bị hairpin từ trong docker → treo).
-- Code sẽ nối '/v1' vào base_url → http://10.2.13.58:11434/v1 (OpenAI-compatible).
-- CHỈ áp dụng instance Research; no-op nơi khác.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '015_research_central_ollama_internal: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  -- provider ollama (ghi đè 'skip' của migration 014)
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', 'ollama')
  ON CONFLICT (key) DO UPDATE SET value = 'ollama'
    WHERE ai_portal.app_settings.value IN ('', 'skip');

  -- base_url nội bộ (ghi đè URL công khai bị hairpin)
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_base_url', 'http://10.2.13.58:11434')
  ON CONFLICT (key) DO UPDATE SET value = 'http://10.2.13.58:11434'
    WHERE ai_portal.app_settings.value IN ('', 'https://research.neu.edu.vn/ollama');

  -- model nhanh, hỗ trợ tool, tiếng Việt tốt
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', 'gpt-oss:20b')
  ON CONFLICT (key) DO UPDATE SET value = 'gpt-oss:20b'
    WHERE ai_portal.app_settings.value IN ('', 'qwen3:8b');

  RAISE NOTICE '015_research_central_ollama_internal: Central trỏ Ollama nội bộ 10.2.13.58:11434 (gpt-oss:20b) cho Research.';
END $$;
