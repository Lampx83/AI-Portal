-- 016: Lại đặt Central provider='skip' trên Research để KHÔNG treo 60s.
-- Đã thử base_url nội bộ http://10.2.13.58:11434 (ollama trên .232) nhưng container backend .223 vẫn
-- không gọi được (504) — nhiều khả năng firewall giữa .223 và .232 chỉ mở cổng Kong (8037), không mở
-- 11434; và Kong hiện KHÔNG có route tới ollama. Cần URL mà CONTAINER .223 gọi được (do quản trị biết
-- rõ Kong/nginx/tunnel cung cấp) rồi đặt trong Admin → Central, hoặc migration sau.
-- Giữ base_url/model đã set (bỏ qua khi provider='skip'). CHỈ áp dụng Research; no-op nơi khác.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '016_research_central_skip_again: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_llm_provider', 'skip')
  ON CONFLICT (key) DO UPDATE SET value = 'skip'
    WHERE ai_portal.app_settings.value = 'ollama';

  RAISE NOTICE '016_research_central_skip_again: Central provider về skip (tránh treo) cho Research.';
END $$;
