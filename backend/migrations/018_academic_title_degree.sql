-- Tách Chức vụ thành Học hàm và Học vị
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS academic_title TEXT;
ALTER TABLE research_chat.users ADD COLUMN IF NOT EXISTS academic_degree TEXT;

COMMENT ON COLUMN research_chat.users.academic_title IS 'Học hàm: Giảng viên, Phó Giáo sư, Giáo sư';
COMMENT ON COLUMN research_chat.users.academic_degree IS 'Học vị: Cử nhân, Thạc sĩ, Tiến sĩ';
