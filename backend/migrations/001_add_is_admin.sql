-- Thêm cột is_admin cho bảng users (chạy khi đã có DB cũ)
ALTER TABLE research_chat.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
