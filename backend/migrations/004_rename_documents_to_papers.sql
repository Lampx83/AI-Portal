-- Migration: Đổi alias của agent "documents" thành "papers"
UPDATE research_chat.research_assistants
SET alias = 'papers',
    domain_url = CASE
      WHEN domain_url = 'https://research.neu.edu.vn/api/agents/documents' THEN 'https://research.neu.edu.vn/api/agents/papers'
      ELSE domain_url
    END,
    updated_at = now()
WHERE alias = 'documents';
