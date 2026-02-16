# create-ai-portal

Create a new AI-Portal project with one command — like `create-react-app` or `create-strapi-app`.

**AI-Portal** is a self-hosted AI operations platform: chat, virtual assistants, RAG, multi-Agent. Configure via **/setup** and **Admin**; no `.env` file required by default.

- **Repo:** [Lampx83/AI-Portal](https://github.com/Lampx83/AI-Portal)
- **npm:** [create-ai-portal](https://www.npmjs.com/package/create-ai-portal)

---

## Usage

```bash
npx create-ai-portal@latest
```

Creates an `ai-portal-app` folder in the current directory (or prompts for a folder name).

Or specify a folder name:

```bash
npx create-ai-portal@latest my-portal
```

The CLI will:

1. Download the latest [AI-Portal](https://github.com/Lampx83/AI-Portal) from GitHub.
2. Extract it into your chosen folder (the `create-ai-portal` folder is omitted from the scaffold).
3. Ask whether to run Docker now; if yes, runs `docker compose up -d`.

When done, open **http://localhost:3000** → **/setup** to complete first-time configuration.

---

## After creating the project

1. **http://localhost:3000** → redirects to **/setup**.
2. **Step 1 — Language:** Choose default language (vi, en, …).
3. **Step 2 — Branding:** Enter app name and upload logo (icon).
4. **Step 3 — Database:** Confirm or change Postgres database name, then run init.
5. **Step 4 — Admin:** Create the first admin account.
6. **Step 5 — Central assistant:** Configure LLM for Central (OpenAI / Gemini) or skip.

The rest (NEXTAUTH_SECRET, Azure AD, OpenAI key, Qdrant, locale packages, …) is configured in **Admin → System settings** (Settings). Values are stored in the database.

**Adding Agents:** Deploy your Agent API (see `frontend/docs/README.md`), then in **Admin → Agents** add alias + base URL. **Adding applications:** Follow the standard (GET /metadata) and add in **Admin → Applications** (see `docs/APPLICATIONS.md`).

---

## Requirements

- **Node.js 18+** — to run `npx create-ai-portal`.
- **Docker & Docker Compose** — to run the full stack (PostgreSQL, Qdrant, backend, frontend).

If you skip Docker when creating the project, run later:

```bash
cd <folder-name>
docker compose up -d
```

---

## More information

- **Vision & features:** [VISION.md](https://github.com/Lampx83/AI-Portal/blob/main/VISION.md) in the AI-Portal repo.
- **Developer guide:** [docs/DEVELOPERS.md](https://github.com/Lampx83/AI-Portal/blob/main/docs/DEVELOPERS.md).
