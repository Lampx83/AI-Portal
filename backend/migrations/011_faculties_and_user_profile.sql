-- Bảng Khoa/Viện (danh mục, quản trị trong Database tab)
CREATE TABLE IF NOT EXISTS research_chat.faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faculties_display_order ON research_chat.faculties(display_order);

-- Cột hồ sơ người dùng: Họ và tên (từ SSO), Chức vụ, Khoa viện, Giới thiệu, Định hướng nghiên cứu
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES research_chat.faculties(id) ON DELETE SET NULL;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS intro TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS research_direction JSONB;

-- Seed danh sách Khoa/Viện mặc định
INSERT INTO research_chat.faculties (name, display_order) VALUES
  ('Khoa Kinh tế', 1),
  ('Khoa Quản trị Kinh doanh', 2),
  ('Khoa Tài chính - Ngân hàng', 3),
  ('Khoa Kế toán - Kiểm toán', 4),
  ('Khoa Thương mại', 5),
  ('Khoa Luật Kinh tế', 6),
  ('Khoa Quan hệ Quốc tế', 7),
  ('Khoa Công nghệ Thông tin', 8),
  ('Viện Đào tạo Quốc tế', 9),
  ('Viện Nghiên cứu Kinh tế', 10)
ON CONFLICT (name) DO NOTHING;
