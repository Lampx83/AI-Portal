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

**Dev 100% Docker với basePath (tuyen-sinh tại localhost:8010/tuyen-sinh):**

Chạy toàn bộ (postgres, minio, backend, frontend) trong Docker, hot reload, basePath `/tuyen-sinh`, frontend lắng nghe cổng **8010**:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.dev-tuyen-sinh.yml up --build
```

Hoặc từ thư mục gốc repo (có thư mục `scripts/`): `./scripts/dev-ai-portal-docker.sh --tuyen-sinh`

Mở **http://localhost:8010/tuyen-sinh**. Sửa code trong `backend/src` và `frontend/` (app, components, lib, …) sẽ được mount vào container và tự reload.

#### Run in dev mode (without Docker)

Run only Postgres and MinIO in Docker, then start backend and frontend locally (Node.js 18+):

1. **Start Postgres and MinIO:** `docker compose up -d postgres minio`
2. **Backend:** `cd backend && npm install && npm run dev` — set `POSTGRES_HOST=localhost`, `MINIO_ENDPOINT=localhost` in `.env` if needed.
3. **Frontend:** `cd frontend && npm install && npm run dev` — set `BACKEND_URL=http://localhost:3001`, `NEXTAUTH_URL=http://localhost:3000` in `.env.local` or env.

Open [http://localhost:3000](http://localhost:3000); backend at [http://localhost:3001](http://localhost:3001).

**Test với basePath (vd. hệ thống tuyển sinh tại localhost:8010/tuyen-sinh):**

Từ thư mục gốc repo (chứa `scripts/`), chạy:

```bash
./scripts/dev-ai-portal.sh --tuyen-sinh
```

Script sẽ: đặt `BASE_PATH=/tuyen-sinh`, frontend cổng **8010**, `NEXTAUTH_URL=http://localhost:8010/tuyen-sinh`. Backend vẫn chạy cổng 3001. Sau khi chạy xong, mở **http://localhost:8010/tuyen-sinh** để dùng Portal (login, admin, embed đều hoạt động dưới subpath). Cấu hình tương tự khi deploy production dưới subpath (xem `docs/APPLICATIONS.md` và mục 3.5 Docker Hub subpath). **Lưu ý:** Khi dùng basePath, `NEXTAUTH_URL` phải là URL đầy đủ có basePath (vd. `https://ai.neu.edu.vn/tuyen-sinh`); nếu thiếu sẽ dễ gặp lỗi "Connection closed" và trang load mãi.

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

## Scaling & performance (nhiều người truy cập)

Để AI Portal chịu tải nhiều user đồng thời, đã tích hợp sẵn và nên cấu hình thêm:

### Đã có trong code

- **Backend**
  - **Nén response (gzip):** middleware `compression` — giảm băng thông, nhanh hơn trên mạng chậm.
  - **Rate limit:** `express-rate-limit` — mặc định 300 request/phút/IP. Tắt bằng `RATE_LIMIT_MAX=0`; chỉnh `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS` (ms) qua env.
  - **Connection pool Postgres:** `POSTGRES_POOL_MAX` (mặc định 20, max 100) — tăng khi nhiều request đồng thời; đảm bảo `max_connections` của Postgres đủ cho tổng pool của mọi replica backend.
  - **Cache-Control:** API public (danh sách assistants, site-strings, embed-config) trả về header `Cache-Control` với `max-age` và `stale-while-revalidate` để browser/CDN cache.
- **Frontend**
  - **Static assets:** `/_next/static/*` có `Cache-Control: public, max-age=31536000, immutable` — CDN và browser cache lâu.

### Nên cấu hình thêm khi scale

1. **Reverse proxy (Nginx / Caddy)**  
   Bật nén (gzip), cache static tại proxy, `client_max_body_size 50m` cho `/api/` (upload). Có thể cache thêm GET `/api/assistants`, `/api/site-strings` tại proxy nếu cần.

2. **Tăng replica**  
   Chạy nhiều instance backend và frontend phía sau load balancer. Trong Docker Compose / Portainer có thể set `deploy.replicas: 2` (hoặc hơn) cho `backend` và `frontend`. Đảm bảo session: NextAuth dùng JWT (stateless) nên không cần sticky session.

3. **PostgreSQL**  
   Tăng `max_connections` (vd. 200) nếu chạy nhiều replica backend; mỗi replica dùng tối đa `POSTGRES_POOL_MAX` kết nối. Cân nhắc PgBouncer nếu số connection rất lớn.

4. **CDN**  
   Đưa static (frontend, `/_next/static`) lên CDN để giảm tải server và giảm độ trễ theo vùng.

5. **Giới hạn tài nguyên container**  
   Frontend: Memory limit ≥ 2.5GB, `NODE_OPTIONS=--max-old-space-size=2048`. Backend: CPU/Memory đủ cho pool và rate limit.

### Đảm bảo hệ thống không sập khi nhiều truy cập

- **Graceful shutdown (backend):** Khi Docker/Kubernetes gửi SIGTERM, backend không nhận request mới, đợi request hiện tại xong, đóng pool Postgres rồi thoát. Load balancer sẽ bỏ instance đang shutdown khỏi vòng quay. Trong vòng 25s nếu chưa đóng xong thì thoát cưỡng bức.
- **Health check không bị rate limit:** `/health` và `/` được loại khỏi rate limit để load balancer/Portainer luôn kiểm tra được và không đánh dấu container unhealthy vì 429.
- **Khi đang shutdown:** `GET /health` trả về 503 với `status: "shutting_down"` để load balancer ngừng gửi traffic tới instance đó.
- **Unhandled rejection:** Promise reject không bắt được sẽ được log, **không** làm crash process — một request lỗi không kéo sập cả server khi nhiều user.
- **Restart policy:** Trong Docker/Portainer dùng `restart: unless-stopped` (đã có trong stack) để container tự khởi động lại nếu crash.
- **Nên:** Chạy ≥ 2 replica backend + frontend và đặt giới hạn RAM/CPU để một instance sập không làm mất toàn bộ dịch vụ.

---

## Troubleshooting

- **Frontend (Docker dev):** `Cannot find package 'dotenv'` — The config now loads `.env` only when `dotenv` is available (optional). Rebuild the frontend dev image: `docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache frontend`, then `up` again.
- **Backend:** `database "X" does not exist` — The backend uses the database name from **/setup** (saved in `backend/data/setup-db.json`). If you see this with a name like `admission`, that DB was never created in the current Postgres. Fix: open **http://localhost:3000/setup** and complete **Step 2 (Database)** to create and init the DB, or create the database manually and run `schema.sql` (e.g. `psql -h localhost -U postgres -c "CREATE DATABASE admission;"` then run the schema).
- **Portainer / Docker deploy:** (1) **`FATAL ERROR: JavaScript heap out of memory`** — Container frontend cần **Memory limit ≥ 2.5GB** (khuyến nghị **3GB**). Stack set `NODE_OPTIONS=--max-old-space-size=2048`. Cần **rebuild image frontend** và deploy lại sau khi sửa. (2) **`getaddrinfo EAI_AGAIN backend`** — Frontend và backend phải **cùng network**, service backend tên **`backend`** (hoặc set `BACKEND_URL=http://<tên-service>:3001`).
- **Tại sao frontend tốn nhiều RAM?** Next.js server (Node) khi chạy nạp toàn bộ app: (1) **CKEditor** — hơn 20 gói trong `transpilePackages`, dependency tree rất nặng; (2) **Nhiều thư viện UI** — Radix UI, Recharts, KaTeX, react-syntax-highlighter, next-auth; (3) **Next.js 15** — RSC cache, route tree, rewrites/proxy; (4) **Middleware** — chạy mỗi request (getToken, fetch backend). Giải pháp: tăng Memory limit container (2.5–3GB), set `NODE_OPTIONS=--max-old-space-size=2048` (hoặc 2560 nếu có ≥3GB). Đã tắt `productionBrowserSourceMaps` và `devtool` trong production để giảm bớt.

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
