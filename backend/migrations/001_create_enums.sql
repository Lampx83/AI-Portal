-- Migration 001: Tạo extensions và enum types cần cho restore
-- pg_dump -n ai_portal không dump extensions (citext, pgcrypto) và types ở public.
-- Chạy idempotent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE public.message_role AS ENUM ('user', 'assistant', 'system', 'tool', 'orchestrator');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status') THEN
    CREATE TYPE public.message_status AS ENUM ('ok', 'partial', 'error');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_type') THEN
    CREATE TYPE public.content_type AS ENUM ('text', 'markdown', 'json', 'code');
  END IF;
END$$;
