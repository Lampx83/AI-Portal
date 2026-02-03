-- Thêm cột role: 'user' | 'admin' | 'developer'
-- Người dùng, Người quản trị, Người phát triển
ALTER TABLE research_chat.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Migrate từ is_admin: true -> 'admin', false -> 'user'
UPDATE research_chat.users
SET role = CASE WHEN is_admin = true THEN 'admin' ELSE 'user' END;

-- Ràng buộc giá trị
ALTER TABLE research_chat.users
  DROP CONSTRAINT IF EXISTS chk_users_role;

ALTER TABLE research_chat.users
  ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin', 'developer'));

COMMENT ON COLUMN research_chat.users.role IS 'Quyền: user (Người dùng), admin (Người quản trị), developer (Người phát triển)';
