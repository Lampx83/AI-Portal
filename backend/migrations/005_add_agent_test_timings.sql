-- Migration: Thêm cột thời gian phản hồi (ms) cho mỗi endpoint test
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS metadata_ms INTEGER;
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS data_documents_ms INTEGER;
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS data_experts_ms INTEGER;
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS ask_text_ms INTEGER;
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS ask_file_ms INTEGER;
