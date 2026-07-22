-- 018: Sửa base_url Central sang Kong NỘI BỘ (container .223 gọi được).
-- Chẩn đoán từ trong container aiportal-backend (.223):
--   http://101.96.66.232:8037/ollama (Kong public IP) → FETCH FAILED (container không tới IP public)
--   http://10.2.13.58:8037/ollama    (Kong nội bộ)     → OK 200, 19ms, có qwen2.5:14b-instruct-ctx16k
-- → dùng địa chỉ Kong nội bộ 10.2.13.58:8037. Giữ nguyên header x-ollama-seckey + model qwen2.5:14b.
-- Ghi đè base_url public của migration 017. CHỈ áp dụng Research; no-op nơi khác.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '018_research_central_kong_internal: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_base_url', 'http://10.2.13.58:8037/ollama')
  ON CONFLICT (key) DO UPDATE SET value = 'http://10.2.13.58:8037/ollama';

  -- đảm bảo provider/model/header đúng (phòng khi 017 chưa áp dụng đủ)
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', 'ollama')
  ON CONFLICT (key) DO UPDATE SET value = 'ollama';
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', 'qwen2.5:14b-instruct-ctx16k')
  ON CONFLICT (key) DO UPDATE SET value = 'qwen2.5:14b-instruct-ctx16k';
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_extra_headers', '{"x-ollama-seckey":"research"}')
  ON CONFLICT (key) DO UPDATE SET value = '{"x-ollama-seckey":"research"}';

  RAISE NOTICE '018_research_central_kong_internal: Central trỏ Kong nội bộ 10.2.13.58:8037 cho Research.';
END $$;
