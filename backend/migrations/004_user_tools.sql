-- Migration 004: Tools cài bởi user (chỉ tài khoản đó thấy). user_id NULL = tool toàn hệ thống (Admin).
-- Admin cài = global; user cài từ Dialog Tools = chỉ mình user đó.

-- 1. Thêm cột user_id (nullable)
ALTER TABLE ai_portal.tools ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES ai_portal.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tools_user_id ON ai_portal.tools(user_id) WHERE user_id IS NOT NULL;

-- 2. Bỏ ràng buộc UNIQUE(alias) cũ (tên có thể là tools_alias_key tùy PG)
DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'ai_portal' AND t.relname = 'tools' AND c.contype = 'u'
      AND array_length(c.conkey, 1) = 1
      AND (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped) = 'alias'
  LOOP
    EXECUTE format('ALTER TABLE ai_portal.tools DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

-- 3. Unique: global (alias khi user_id IS NULL); user (user_id, alias khi user_id NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_global_alias ON ai_portal.tools(alias) WHERE user_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_user_alias ON ai_portal.tools(user_id, alias) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN ai_portal.tools.user_id IS 'NULL = tool toàn hệ thống (Admin cài). Có giá trị = tool chỉ user đó (cài từ Dialog Tools).';
