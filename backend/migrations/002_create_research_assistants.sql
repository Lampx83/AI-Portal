-- Migration: Tạo bảng research_assistants để lưu trữ và quản lý agents
-- Tất cả agents (bao gồm main) được lưu trong DB, không hardcode trong code

CREATE TABLE IF NOT EXISTS research_chat.research_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'Bot',
  base_url TEXT NOT NULL,
  domain_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  config_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_assistants_alias ON research_chat.research_assistants(alias);
CREATE INDEX IF NOT EXISTS idx_research_assistants_active ON research_chat.research_assistants(is_active, display_order);

-- Seed dữ liệu sẽ được thực hiện trong server.ts khi khởi động
-- (để có thể đọc env vars từ process.env)
