-- 017: Bật Central trên Research qua Ollama sau Kong gateway (container .223 GỌI ĐƯỢC).
-- Endpoint: http://101.96.66.232:8037/ollama  (code nối '/v1' → .../ollama/v1/chat/completions, OpenAI-compat).
-- Header bắt buộc của Kong: x-ollama-seckey → đặt qua central_llm_extra_headers (cấu hình trên máy chủ, không lưu trong repo).
-- Model: qwen2.5:14b-instruct-ctx16k (không reasoning, 16k context → nhanh, hợp cho trợ lý có prompt lớn).
-- Đã kiểm chứng: /api/tags, /api/generate, /v1/chat/completions, /v1/models đều OK qua Kong 8037.
-- Ghi đè trạng thái 'skip' của các migration 014/016. CHỈ áp dụng Research; no-op nơi khác.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '017_research_central_kong_ollama: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', 'ollama')
  ON CONFLICT (key) DO UPDATE SET value = 'ollama';

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_base_url', 'http://101.96.66.232:8037/ollama')
  ON CONFLICT (key) DO UPDATE SET value = 'http://101.96.66.232:8037/ollama';

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', 'qwen2.5:14b-instruct-ctx16k')
  ON CONFLICT (key) DO UPDATE SET value = 'qwen2.5:14b-instruct-ctx16k';

  -- central_llm_extra_headers (header x-ollama-seckey của Kong) KHÔNG lưu trong mã nguồn:
  -- quản trị viên đặt trong Admin → Trợ lý chính, hoặc UPDATE ai_portal.app_settings trên máy chủ.

  RAISE NOTICE '017_research_central_kong_ollama: Central trỏ Ollama qua Kong (qwen2.5:14b-instruct-ctx16k) cho Research.';
END $$;
