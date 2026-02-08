-- Thêm cột tags và icon cho research_projects (phân loại và biểu tượng nghiên cứu)
ALTER TABLE research_chat.research_projects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE research_chat.research_projects ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'FolderKanban';

COMMENT ON COLUMN research_chat.research_projects.tags IS 'Tag phân loại nghiên cứu (vd: AI, ML, thống kê)';
COMMENT ON COLUMN research_chat.research_projects.icon IS 'Tên icon lucide-react để hiển thị (vd: FolderKanban, FileText, Beaker)';
