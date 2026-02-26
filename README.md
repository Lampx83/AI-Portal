# AI-Portal

**AI operations platform** — self-hosted on your infrastructure. Enables developers to build AI applications for businesses and organizations: create Agents (API), register them in the Portal; **no need to build the UI yourself**. The Admin panel manages and controls the entire system.

- Chat, virtual assistants, installable apps, multi-Agent — a single deployment point. Optional plugins.
- **Developers:** deploy Agents via the standard API → register in Admin → users can use them immediately via web/embed.
- **Enterprises:** manage users, projects, agents, limits, feedback, database, storage through Admin.
- Vision: **[VISION.md](./VISION.md)**. Short developer guide: **[docs/DEVELOPERS.md](./docs/DEVELOPERS.md)**.

- **GitHub:** [Lampx83/AI-Portal](https://github.com/Lampx83/AI-Portal)
- **Docs & website:** [ai-portal-nine.vercel.app](https://ai-portal-nine.vercel.app/) — hướng dẫn, tài liệu, tạo project
- **npm (one-command install):** [create-ai-portal](https://www.npmjs.com/package/create-ai-portal)

## Quick install (single command)

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
- **Docker** and **Docker Compose** — to run the full stack (PostgreSQL, MinIO, backend, frontend)
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

- **Frontend:** [http://localhost:3000](http://localhost:3000)  
- **Backend API:** [http://localhost:3001](http://localhost:3001)  
- **PostgreSQL:** port 5432 (internal)  
- **MinIO:** API [http://localhost:9000](http://localhost:9000), Console [http://localhost:9001](http://localhost:9001)

Check status:

```bash
docker compose ps
```

View logs (frontend/backend):

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

#### Run in dev mode (with Docker)

Use the dev override so backend and frontend run with hot reload (source mounted):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Same URLs: [Frontend](http://localhost:3000), [Backend API](http://localhost:3001). Edit `backend/src` and `frontend/`; changes apply without rebuilding.

#### Run in dev mode (without Docker)

Run only Postgres and MinIO in Docker, then start backend and frontend locally (Node.js 18+):

1. **Start Postgres and MinIO:** `docker compose up -d postgres minio`
2. **Backend:** `cd backend && npm install && npm run dev` — set `POSTGRES_HOST=localhost`, `MINIO_ENDPOINT=localhost` in `.env` if needed.
3. **Frontend:** `cd frontend && npm install && npm run dev` — set `BACKEND_URL=http://localhost:3001`, `NEXTAUTH_URL=http://localhost:3000` in `.env.local` or env.

Open [http://localhost:3000](http://localhost:3000); backend at [http://localhost:3001](http://localhost:3001).

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

To also remove data (DB and other volumes):

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

### 3.5. Publish images to Docker Hub

Để đẩy image backend và frontend lên Docker Hub (để dùng ở server khác, Portainer, hoặc Research/Tuyen-sinh):

**Cách 1: GitHub Actions (khuyến nghị)**

1. Trong repo AI-Portal → **Settings** → **Secrets and variables** → **Actions**: thêm:
   - `DOCKERHUB_USER` = username Docker Hub
   - `DOCKERHUB_TOKEN` = Access token (Docker Hub → Account Settings → Security → New Access Token)
2. **Actions** → **Push to Docker Hub** → **Run workflow** (hoặc mỗi lần push lên `main` workflow tự chạy).

**Cách 2: Máy local / server có Docker**

1. **Đăng nhập Docker Hub:** `docker login` (nhập username + password hoặc token).
2. **Đặt username:** `export DOCKERHUB_USER=your-dockerhub-username`
3. **Build và push:** `./push-dockerhub.sh`

Hoặc thủ công:

```bash
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml build backend frontend
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml push backend frontend
```

Image sẽ có tên: `$DOCKERHUB_USER/ai-portal-backend:latest` và `$DOCKERHUB_USER/ai-portal-frontend:latest`. Trên server khác có thể pull và chạy (vd. Portainer stack, Research/Tuyen-sinh deploy).

**Frontend cho subpath:** Workflow Push to Docker Hub tự build và đẩy thêm image tag `:subpath` (BASE_PATH=/tuyen-sinh, URL mặc định https://ai.neu.edu.vn/tuyen-sinh). Trong stack Tuyen-sinh dùng image `.../ai-portal-frontend:subpath` và đặt `NEXTAUTH_URL=https://ai.neu.edu.vn/tuyen-sinh`. Chi tiết xem Portal-Deploy/Tuyen-sinh/README.md mục "Triển khai dưới subpath".

### 3.6. Chạy trên server (tải từ Docker Hub)

Trên server (VPS/cloud) chỉ cần Docker và Docker Compose. **Không cần** clone toàn bộ source, chỉ cần hai file compose.

**Bước 1: Cài Docker và Docker Compose** (nếu chưa có)

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker && sudo systemctl start docker
```

**Bước 2: Tạo thư mục và tải hai file compose**

```bash
mkdir -p ~/ai-portal && cd ~/ai-portal
curl -sO https://raw.githubusercontent.com/Lampx83/AI-Portal/main/docker-compose.yml
curl -sO https://raw.githubusercontent.com/Lampx83/AI-Portal/main/docker-compose.dockerhub.yml
```

*(Nếu repo của bạn là fork, thay `Lampx83/AI-Portal` và nhánh `main` bằng đường dẫn tương ứng, hoặc clone cả repo: `git clone https://github.com/YOUR_USER/AI-Portal.git && cd AI-Portal`.)*

**Bước 3: Chỉ định image Docker Hub của bạn**

```bash
export DOCKERHUB_USER=your-dockerhub-username
```

**Bước 4: Kéo image và chạy**

```bash
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml pull
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml up -d
```

**Bước 5: Mở ứng dụng**

- Truy cập **http://&lt;IP-server&gt;:3000** (hoặc domain trỏ tới server).
- Lần đầu sẽ vào **/setup**: đặt tên app, icon, tên database, tạo user admin.
- Cấu hình thêm (NEXTAUTH_SECRET, OpenAI, Azure AD…) trong **Admin → System settings**.

**Các lệnh hữu ích:**

```bash
# Xem trạng thái
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml ps

# Xem log
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml logs -f

# Dừng
docker compose -f docker-compose.yml -f docker-compose.dockerhub.yml down
```

**Cập nhật phiên bản mới:** chạy lại `pull` rồi `up -d` (hoặc `docker compose … up -d --pull always`).

---

## Troubleshooting

- **Frontend (Docker dev):** `Cannot find package 'dotenv'` — The config now loads `.env` only when `dotenv` is available (optional). Rebuild the frontend dev image: `docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache frontend`, then `up` again.
- **Backend:** `database "X" does not exist` — The backend uses the database name from **/setup** (saved in `backend/data/setup-db.json`). If you see this with a name like `admission`, that DB was never created in the current Postgres. Fix: open **http://localhost:3000/setup** and complete **Step 2 (Database)** to create and init the DB, or create the database manually and run `schema.sql` (e.g. `psql -h localhost -U postgres -c "CREATE DATABASE admission;"` then run the schema).

---

## Project structure (overview)

- `backend/` — Node.js API, PostgreSQL, MinIO, agents
- `frontend/` — Next.js (React) UI, NextAuth login, backend API client
- `docker-compose.yml` — Services: postgres, minio, backend, frontend
- No `.env` — Configure at **/setup** (app name, icon, DB name) and **Admin → System settings** (rest; stored in DB)
- `create-ai-portal/` — CLI package for `npx create-ai-portal@latest` (scaffold new project)
- `.github/workflows/main.yml` — CI/CD workflow (self-hosted + Docker Compose)

---

## Contributing and license

You may fork, modify, and deploy for personal or organizational use. To contribute back, open a Pull Request. For deployment or configuration questions, open an Issue.
