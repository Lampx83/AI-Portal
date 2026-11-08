-- Sổ danh tính «môi trường thực hành» (công cụ mở trong slide của Học liệu). Xem backend/src/lib/sandbox.ts.
--
-- Tệp này CỐ Ý không đánh số: bộ chạy migration chỉ nhận số lớn hơn MAX(schema_version), mà nhánh
-- research/ar1-ar2-du-lieu đang giữ 026 + 027 chưa triển khai; đánh số ở đây sẽ làm hai tệp đó bị bỏ qua.
-- backend/src/lib/sandbox.ts và backend/scripts/purge-sandbox.mjs tự chạy tệp này (idempotent) trước khi dùng bảng.
--
-- real_user_id không có khoá ngoại: xoá tài khoản thật không được làm mất sổ, nếu không dữ liệu thực hành
-- của tài khoản đó sẽ không bao giờ được dọn. NULL với Khách.
CREATE TABLE IF NOT EXISTS ai_portal.sandbox_users (
  id           uuid PRIMARY KEY,
  real_user_id uuid,
  is_guest     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_users_last_seen ON ai_portal.sandbox_users (last_seen);
