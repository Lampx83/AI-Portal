-- Link Google Scholar cho hồ sơ người dùng
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS google_scholar_url TEXT;

COMMENT ON COLUMN research_chat.users.google_scholar_url IS 'URL hồ sơ Google Scholar, ví dụ: https://scholar.google.com/citations?user=xxx';
