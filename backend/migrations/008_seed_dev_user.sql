-- Seed tài khoản dev user@example.com / password123
-- Hash: scrypt với salt cố định, password "password123"
-- Nếu user chưa có: INSERT. Nếu đã có nhưng chưa có password: UPDATE.
INSERT INTO research_chat.users (id, email, display_name, password_hash, password_algo, password_updated_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'user@example.com',
  'Demo User',
  'scrypt$00000000000000000000000000000000$e778ee713285d4e273c34420ef63702cc6a9f91db8da95eca3f0431e09dd50411e11a55d5a1d5c90f0fbdb5598fd3276076ed743913c01e4884cff8d816bf7a7',
  'scrypt',
  now(),
  now(),
  now()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  password_algo = EXCLUDED.password_algo,
  password_updated_at = EXCLUDED.password_updated_at,
  updated_at = now()
WHERE research_chat.users.password_hash IS NULL;
