# AI-Portal Website

Marketing and documentation landing site for [AI-Portal](https://github.com/Lampx83/AI-Portal), similar to [strapi.io](https://strapi.io/).

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **TypeScript**

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Deploy on Vercel

1. Push this repo (with `website/` at root or as subpath).
2. In [Vercel](https://vercel.com), import the repo.
3. Set **Root Directory** to `website`.
4. Deploy. No extra env vars needed.

Or use Vercel CLI from this folder:

```bash
cd website && npx vercel
```

## Structure

- **Hero** — Headline, `npx create-ai-portal@latest`, Get Started
- **Product** — Features (chat, assistants, RAG, self-hosted, setup, admin)
- **Solutions** — For developers, teams, enterprise
- **Developers** — Quick start, Docs, GitHub, npm
- **Docs** — Placeholder linking to repo docs (can be replaced with a full docs site later)
