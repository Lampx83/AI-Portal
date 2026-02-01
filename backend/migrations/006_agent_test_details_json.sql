-- Chi tiết test: data (từng provided_data_types), ask text (từng model), ask file (từng định dạng)
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS data_details JSONB;
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS ask_text_details JSONB;
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS ask_file_details JSONB;
-- data_details: [{ "type": "documents", "pass": true, "ms": 100 }, ... ]
-- ask_text_details: [{ "model_id": "gpt-4o-mini", "pass": true, "ms": 500 }, ... ]
-- ask_file_details: [{ "format": "pdf", "pass": true, "ms": 600 }, ... ]
