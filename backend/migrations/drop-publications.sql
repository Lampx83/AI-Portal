-- Drop publications feature (table + index)
DROP INDEX IF EXISTS ai_portal.idx_publications_user_id;
DROP TABLE IF EXISTS ai_portal.publications;
