-- Chi tiết metadata test: curl + response (để xem lệnh và kết quả)
ALTER TABLE research_chat.agent_test_results ADD COLUMN IF NOT EXISTS metadata_details JSONB;
-- metadata_details: { "curl": "curl -X GET '...'", "response": { ... } }
