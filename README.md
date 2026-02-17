# AI-Portal

**AI operations platform** — self-hosted on your infrastructure. Enables developers to build AI applications for businesses and organizations: create Agents (API), register them in the Portal; **no need to build the UI yourself**. The Admin panel manages and controls the entire system.

- Chat, virtual assistants, RAG, multi-Agent — a single deployment point.
- **Developers:** deploy Agents via the standard API → register in Admin → users can use them immediately via web/embed.
- **Enterprises:** manage users, projects, agents, limits, feedback, database, storage through Admin.
- Vision: **[VISION.md](./VISION.md)**. Short developer guide: **[docs/DEVELOPERS.md](./docs/DEVELOPERS.md)**.

- **GitHub:** [Lampx83/AI-Portal](https://github.com/Lampx83/AI-Portal)
- **Docs & website:** [ai-portal-nine.vercel.app](https://ai-portal-nine.vercel.app/) — hướng dẫn, tài liệu, tạo project
- **npm (one-command install):** [create-ai-portal](https://www.npmjs.com/package/create-ai-portal)

## Quick install (single command, like Strapi)

```bash
npx create-ai-portal@latest
```

This downloads the AI-Portal template and (optionally) runs Docker. Open http://localhost:3000 → complete **/setup** (app name, icon, database name) → configure the rest in **Admin → System settings**.

Specify a project folder name:

```bash
npx create-ai-portal@latest my-portal
```

---

## System requirements

- **Git** — to download the code (if not using `create-ai-portal`)
- **Docker** and **Docker Compose** — to run the full stack (PostgreSQL, Qdrant, backend, frontend)
- (Optional) **Node.js 18+** — to run `npx create-ai-portal` or dev mode without Docker

---

## 1. Download the code

If you prefer not to use `npx create-ai-portal@latest`, you can download the code manually:

### Option 1: Clone directly

```bash
git clone https://github.com/Lampx83/AI-Portal.git
cd AI-Portal
```

### Option 2: Fork then clone (to manage and deploy via GitHub Actions)

1. On GitHub, click **Fork** on [Lampx83/AI-Portal](https://github.com/Lampx83/AI-Portal) to fork it to your account.
2. Clone your fork (replace `YOUR_USERNAME` with your GitHub username):

```bash
git clone https://github.com/YOUR_USERNAME/AI-Portal.git
cd AI-Portal
```

### Verify after download

- You should see `backend/`, `frontend/`, and `docker-compose.yml` at the project root. There is no `.env` or `.env.example`; configuration is done at **/setup** and **Admin → System settings**.

---

## 2. Run the application

### Step 1: Run with Docker Compose

```bash
docker compose build
docker compose up -d
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:3001  
- **PostgreSQL:** port 5432 (internal)  
- **Qdrant:** port 8010 (if needed from host)

Check status:

```bash
docker compose ps
```

View logs (frontend/backend):

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

### Step 2: First-time setup and config

1. Open **http://localhost:3000** → you will be redirected to **/setup**.
2. **Step 1 — Branding:** Enter app name and upload an icon (logo).
3. **Step 2 — Database:** Confirm or change the Postgres database name, then run init. The app creates the database and schema.
4. **Step 3 — Admin:** Create the first admin user.
5. Configure the rest (NEXTAUTH_SECRET, Azure AD, OpenAI key, etc.) in **Admin → System settings**. Values are stored in the database and applied on next load.

**Adding Agents to the Portal:** Deploy your Agent API (metadata, ask, data — see `frontend/docs/README.md`) then in **Admin → Agents** add alias + base URL. The Agent will appear in the sidebar and chat; no frontend changes needed. **Adding new applications:** follow the standard (GET /metadata) and add in **Admin → Applications** (see `docs/APPLICATIONS.md`).

### Step 3: Stop the application

```bash
docker compose down
```

To also remove data (DB and Qdrant volumes):

```bash
docker compose down -v
```

---

## 3. Deploy (production)

Deploy to a server (VPS/cloud) so users can access it via a domain (e.g. `https://your-domain.com`).

### 3.1. Prepare the server

- Install **Docker** and **Docker Compose** (and **Git** if cloning on the server).
- Open firewall: ports **80**, **443** (web); **22** (SSH) if needed.

### 3.2. Configure for production

After **/setup**, set production values in **Admin → System settings** (e.g. `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`, Azure AD). For CI/CD or Docker-only config you can still pass env vars; the app also loads settings from the database (`app_settings` table).

### 3.3. Manual deploy on the server

On the server:

```bash
git clone https://github.com/Lampx83/AI-Portal.git   # or your fork
cd AI-Portal
docker compose build --no-cache
docker compose up -d
```

Then open **https://your-domain.com/setup** to set app name, icon, database name, and create the first admin. Configure the rest in **Admin → System settings**.

Then configure a **reverse proxy** (Nginx or Caddy) to:

- Listen on HTTPS (port 443) for `your-domain.com`
- Proxy `https://your-domain.com` → `http://127.0.0.1:3000` (frontend)
- Proxy `https://your-domain.com/api/` → `http://127.0.0.1:3001/` (backend API, if frontend doesn't proxy it)

Set up **SSL** (e.g. Let's Encrypt): use Certbot (Nginx) or Caddy's automatic certificates.

### 3.4. Deploy with GitHub Actions (CI/CD)

The repo includes a **Docker Build and Deploy** workflow (`.github/workflows/main.yml`): on push to `main` (or manual run), it builds Docker and runs `docker compose up -d` on the runner machine.

To use it:

1. **Self-hosted runner** — The workflow uses `runs-on: self-hosted`. Install the runner on your server: **Settings** → **Actions** → **Runners** → **New self-hosted runner**.
2. **GitHub Secrets** — In the repo go to **Settings** → **Secrets and variables** → **Actions**, and add secrets: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AZURE_AD_*`, `CORS_ORIGIN`, `OPENAI_API_KEY`, etc. (names must match the workflow).
3. **Run the workflow** — Push to `main` or use **Actions** → **Run workflow**.

After the job finishes, configure Nginx/Caddy and SSL to access the app via your domain.

---

## Project structure (overview)

- `backend/` — Node.js API, PostgreSQL, Qdrant, agents
- `frontend/` — Next.js (React) UI, NextAuth login, backend API client
- `docker-compose.yml` — Services: postgres, qdrant, backend, frontend
- No `.env` — Configure at **/setup** (app name, icon, DB name) and **Admin → System settings** (rest; stored in DB)
- `create-ai-portal/` — CLI package for `npx create-ai-portal@latest` (scaffold new project)
- `.github/workflows/main.yml` — CI/CD workflow (self-hosted + Docker Compose)

---

## Contributing and license

You may fork, modify, and deploy for personal or organizational use. To contribute back, open a Pull Request. For deployment or configuration questions, open an Issue.
