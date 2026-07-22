-- 014: Tạm khôi phục provider Central trên Research về 'skip' để KHÔNG treo 60s (504).
-- Bối cảnh: các migration 011/013 đã trỏ Central sang Ollama nội bộ, nhưng container backend KHÔNG gọi
-- được base URL công khai 'https://research.neu.edu.vn/ollama' (hairpin từ trong mạng docker) → OpenAI SDK
-- không có timeout → treo tới timeout nginx 60s. Đặt provider='skip' để Central trả về thông báo
-- "Chưa cấu hình LLM — vào Admin cấu hình" tức thì, không treo.
-- Khi có endpoint LLM MÀ CONTAINER GỌI ĐƯỢC (Ollama nội bộ theo IP/hostname docker, hoặc API ngoài
-- như DashScope/OpenAI kèm key), admin đặt lại provider/model/base_url/api_key trong Admin → Central.
-- Model/base_url/routing đã set ở 011–013 giữ nguyên (bị bỏ qua khi provider='skip').
-- CHỈ áp dụng instance Research; no-op nơi khác.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '014_research_central_provider_revert: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', 'skip')
  ON CONFLICT (key) DO UPDATE SET value = 'skip'
    WHERE ai_portal.app_settings.value = 'ollama';

  RAISE NOTICE '014_research_central_provider_revert: Central provider về skip (tránh treo) cho Research.';
END $$;
