-- Đảm bảo bảng users có đủ cột cho SSO, password, last_login
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS password_algo TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS sso_provider TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS sso_subject TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
