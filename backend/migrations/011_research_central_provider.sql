-- 011: Cấu hình LLM provider cho Trợ lý Central trên instance Research → dùng Ollama nội bộ (qwen3:8b).
-- CHỈ áp dụng cho instance Research (guard theo tool paperfinder/journal-conference).
-- An toàn: chỉ GHI ĐÈ khi giá trị hiện tại rỗng hoặc 'skip' (tức Central chưa được cấu hình / đang tắt);
-- nếu admin đã đặt provider hoạt động khác thì KHÔNG đụng tới.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '011_research_central_provider: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  -- Provider: đặt/ sửa về ollama nếu chưa cấu hình hoặc đang 'skip'
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', 'ollama')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE ai_portal.app_settings.value IS NULL OR ai_portal.app_settings.value = '' OR ai_portal.app_settings.value = 'skip';

  -- Model: chỉ set nếu chưa có (không ghi đè lựa chọn của admin)
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_model', 'qwen3:8b')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE ai_portal.app_settings.value IS NULL OR ai_portal.app_settings.value = '';

  -- Base URL: chỉ set nếu chưa có (mặc định code cũng là URL này, set tường minh cho chắc)
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_base_url', 'https://research.neu.edu.vn/ollama')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    WHERE ai_portal.app_settings.value IS NULL OR ai_portal.app_settings.value = '';

  -- Bật điều phối (idempotent)
  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_routing_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '011_research_central_provider: đã cấu hình Central dùng Ollama (qwen3:8b) cho instance Research.';
END $$;
