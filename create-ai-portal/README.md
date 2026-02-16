# create-ai-portal

Create a new AI-Portal project with one command.

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
2. Extract it into your chosen folder.
3. Ask whether to run Docker now; if yes, runs `docker compose up -d`.

No `.env` file: after first run, open http://localhost:3000 → **/setup** (app name, icon, database name) → **Admin** for the rest.

## Requirements

- **Node.js 18+** (to run `npx create-ai-portal`).
- **Docker & Docker Compose** (to run the application).
