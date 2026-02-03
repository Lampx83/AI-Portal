-- Migration: Thêm routing_hint vào config_json cho mỗi agent (gợi ý routing khi điều phối)
-- routing_hint: các từ khóa giúp LLM router chọn đúng agent khi câu hỏi liên quan

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Trợ lý điều phối chính')
WHERE alias = 'main';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Tài liệu, bài báo, papers, tìm kiếm tài liệu')
WHERE alias = 'papers';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Chuyên gia, experts, người nghiên cứu')
WHERE alias = 'experts';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Viết bài, soạn thảo, draft')
WHERE alias = 'write';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Dữ liệu, data, thống kê')
WHERE alias = 'data';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Phản biện, review, đánh giá')
WHERE alias = 'review';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Hội thảo, công bố, publication, conference, seminar, sự kiện khoa học')
WHERE alias = 'publish';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Quỹ, tài trợ, funding')
WHERE alias = 'funds';

UPDATE research_chat.research_assistants
SET config_json = COALESCE(config_json, '{}'::jsonb) || jsonb_build_object('routing_hint', 'Đạo văn, plagiarism, kiểm tra trùng lặp')
WHERE alias = 'plagiarism';

-- Cập nhật agents khác (documents nếu còn) - không ghi đè nếu đã có routing_hint
UPDATE research_chat.research_assistants
SET config_json = config_json || jsonb_build_object('routing_hint', 'Tài liệu, bài báo')
WHERE alias = 'documents' AND (config_json->>'routing_hint') IS NULL;
