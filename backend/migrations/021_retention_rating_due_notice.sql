-- Migration 021: Giữ chân người dùng (15/10/2026)
-- 1) Đánh giá nhanh công cụ: user_feedback có thêm điểm sao (1–5) và mã thiết bị khách (giới hạn 1 đánh giá/công cụ/ngày).
--    Nội dung vẫn lưu dạng "[★4] câu góp ý" trong cột content để màn hình Góp ý cũ hiển thị được.
ALTER TABLE ai_portal.user_feedback ADD COLUMN IF NOT EXISTS rating SMALLINT;
ALTER TABLE ai_portal.user_feedback ADD COLUMN IF NOT EXISTS guest_device_id TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_rating_range') THEN
    ALTER TABLE ai_portal.user_feedback ADD CONSTRAINT user_feedback_rating_range CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating_alias
  ON ai_portal.user_feedback (assistant_alias, created_at DESC) WHERE rating IS NOT NULL;

-- 2) Thông báo hạn giai đoạn vòng đời: mỗi (dự án, giai đoạn, ngày hạn, loại mốc) tối đa 1 thông báo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_lifecycle_due
  ON ai_portal.notifications ((payload->>'dedupe_key')) WHERE type = 'lifecycle_due';
