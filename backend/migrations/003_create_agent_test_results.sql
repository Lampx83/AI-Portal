-- Migration: Bảng lưu kết quả test Agents (metadata, data, ask text, ask file)
-- Mỗi lần "Test tất cả Agents" tạo 1 run, mỗi agent có 1 row trong agent_test_results

CREATE TABLE IF NOT EXISTS research_chat.agent_test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_agents INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS research_chat.agent_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES research_chat.agent_test_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES research_chat.research_assistants(id) ON DELETE CASCADE,
  agent_alias TEXT NOT NULL,
  base_url TEXT,
  metadata_pass BOOLEAN,
  data_documents_pass BOOLEAN,
  data_experts_pass BOOLEAN,
  ask_text_pass BOOLEAN,
  ask_file_pass BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_test_results_run_id ON research_chat.agent_test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_results_agent_id ON research_chat.agent_test_results(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_test_runs_run_at ON research_chat.agent_test_runs(run_at DESC);
