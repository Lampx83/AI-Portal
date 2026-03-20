# AI-Portal

**AI operations platform** — self-hosted, no need to build UI yourself. Deploy Agents (API), register in Portal → users access via web/embed. Admin manages users, projects, agents, limits, feedback.

- Chat, assistants, installable apps, multi-Agent — single deployment.
- **Developers:** Deploy Agent API → register in Admin → users use immediately.
- **Enterprises:** Manage via Admin panel (DB, storage, Azure AD, limits).

**Docs:** [ai-portal-nine.vercel.app](https://ai-portal-nine.vercel.app) · **npm:** [create-ai-portal](https://www.npmjs.com/package/create-ai-portal) · **GitHub:** [Lampx83/AI-Portal](https://github.com/Lampx83/AI-Portal)

---

## Quick install

```bash
npx create-ai-portal@latest
# or: npx create-ai-portal@latest my-portal
```

Runs Docker, opens **http://localhost:3000** → complete **/setup** (app name, icon, DB) → configure in **Admin → System settings**.

---

## Requirements

- **Docker** + **Docker Compose** — full stack (PostgreSQL, MinIO, backend, frontend)
- (Optional) **Node.js 18+** — for `npx` or dev without Docker
- **Git** — when cloning manually

---

## Run with Docker

```bash
git clone https://github.com/Lampx83/AI-Portal.git
cd AI-Portal
docker compose build
docker compose up -d
```

| Service    | URL |
|------------|-----|
| Frontend   | http://localhost:3000 |
| Backend API| http://localhost:3001 |
| MinIO Console | http://localhost:9001 |

**Dev (hot reload):**

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**Dev without Docker:** `docker compose up -d postgres minio` → `cd backend && npm run dev` → `cd frontend && npm run dev`. Frontend: http://localhost:3000 (Next.js default).

---

## Setup flow

1. Open app URL → redirect to **/setup**
2. **Step 1:** App name, icon
3. **Step 2:** Database name, init schema
4. **Step 3:** First admin user
5. **Admin → System settings:** NEXTAUTH_SECRET, Azure AD, OpenAI, etc.

No `.env` required — config via /setup and Admin (stored in DB).

---

## Project structure

```
AI-Portal/
├── backend/     # Node.js API, PostgreSQL, MinIO, agents
├── frontend/    # Next.js UI, NextAuth, chat
├── website/     # Docs site (ai-portal-nine.vercel.app)
├── packages/cli/create-ai-portal/  # npx create-ai-portal scaffold
├── docker-compose.yml
└── .github/workflows/
```

---

## Deploy production

1. Clone on server, run `docker compose up -d`
2. Reverse proxy (Nginx/Caddy) → HTTPS, proxy to frontend + `/api/` → backend
3. Or use **GitHub Actions** (`.github/workflows/main.yml`) with self-hosted runner
4. **Docker Hub:** `push-dockerhub.yml` pushes backend/frontend images

See `docs/APPLICATIONS.md`, `docs/DEVELOPERS.md` for details.

---

## Troubleshooting

- **DB "X does not exist":** Run /setup Step 2 or `psql -c "CREATE DATABASE X;"` + schema.
- **Writium on Portal:** `relation "surveylab.write_articles" does not exist` — fixed by resetting `DB_SCHEMA` per app on each request. **`relation "writium.write_articles" does not exist`** — older installs ran `portal-embedded.sql` with placeholder `__SCHEMA__`, which PostgreSQL treated as schema `__schema__`, not `writium`. **Reinstall the Writium zip** after updating Portal (install replaces `__SCHEMA__` with the app alias), or run `backend/migrations/writium-portal-embedded.sql` once on the Portal database. **`503` + “dist/embed.js”** — package must include `backend/dist/embed.js` (`cd backend && npm run build` before `pack`); reinstall after fixing.
- **`embed-config.json` 404:** Install flow now always writes `public/embed-config.json` (may be `{}`). Re-save/reinstall the app if the file was never created.
- **`/embed/.../embed-config.json` 404:** Created when you install a tool from Admin (written under `data/apps/<alias>/public/`). Harmless if the UI still works; reinstall the app package if assets fail to load.
- **Frontend OOM:** Set `NODE_OPTIONS=--max-old-space-size=2048`, Memory limit ≥ 2.5GB.
- **Connection refused:** Ensure backend/frontend on same Docker network, `BACKEND_URL` correct for frontend.

---

## License

Fork, modify, deploy for personal/org use. PRs welcome.
