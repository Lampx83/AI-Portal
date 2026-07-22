-- 012: Tắt routing cho Central trên instance Research.
-- Lý do: bật routing khiến Central gọi tuần tự/gộp nhiều sub-agent (một số dịch vụ nội bộ .223/.13.x
-- hiện chưa sẵn sàng) và KHÔNG stream → treo tới timeout nginx (60s) → lỗi 504.
-- Tắt routing để Central trả lời theo luồng (SSE) nhanh, vẫn function-calling khi cần (có timeout 15s).
-- CHỈ áp dụng instance Research; no-op nơi khác.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ai_portal.tools WHERE alias IN ('paperfinder', 'journal-conference')
  ) THEN
    RAISE NOTICE '012_research_central_routing_off: bỏ qua (không phải instance Research).';
    RETURN;
  END IF;

  INSERT INTO ai_portal.app_settings (key, value) VALUES ('central_routing_enabled', 'false')
  ON CONFLICT (key) DO UPDATE SET value = 'false';

  RAISE NOTICE '012_research_central_routing_off: đã tắt routing Central cho instance Research.';
END $$;
