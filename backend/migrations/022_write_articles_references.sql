-- Thêm cột references (JSONB) cho tài liệu tham khảo / trích dẫn
ALTER TABLE research_chat.write_articles
ADD COLUMN IF NOT EXISTS references_json JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN research_chat.write_articles.references_json IS 'Danh sách tài liệu tham khảo (BibTeX/EndNote/RefMan/RefWorks)';
