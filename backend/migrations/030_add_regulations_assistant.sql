-- Thêm trợ lý "Quy chế, quy định" (tra cứu Qdrant - quy chế NEU về quản lý khoa học)
INSERT INTO research_chat.research_assistants (alias, icon, base_url, domain_url, display_order, config_json)
VALUES (
  'regulations',
  'ShieldCheck',
  'http://localhost:3001/api/regulations_agent/v1',
  NULL,
  9,
  '{"isInternal": true, "routing_hint": "Quy chế, quy định, quy định NEU, quản lý khoa học, quy trình nghiên cứu"}'::jsonb
)
ON CONFLICT (alias) DO NOTHING;
