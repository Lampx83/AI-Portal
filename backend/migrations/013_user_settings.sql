-- Cài đặt hệ thống của người dùng (ngôn ngữ, thông báo, quyền riêng tư, AI, dữ liệu)
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS settings_json JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN research_chat.users.settings_json IS 'User preferences: language, notifications, privacy, ai, data. Defaults: notifications and privacy OFF.';
