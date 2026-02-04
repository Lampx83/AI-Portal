-- Migration: Xóa trợ lý write khỏi research_assistants (đã gom vào trợ lý chính main)
DELETE FROM research_chat.research_assistants
WHERE alias = 'write';
