# AI-Portal Website

Marketing and documentation landing site for [AI-Portal](https://github.com/Lampx83/AI-Portal).

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
- **Product** — Features (chat, assistants, apps, plugins, self-hosted, setup, admin)
- **Solutions** — For developers, teams, enterprise
- **Developers** — Quick start, Docs, GitHub, npm
- **Docs** — Full docs with sidebar; body copy is translated (en, vi, zh, hi, es).

## Docs i18n (5 languages)

Doc body text lives in `src/lib/i18n/locales/` (en, vi, zh, hi, es). Use a namespace per page, e.g. `docs.gettingStarted.*` for Getting Started. In the page component use `useLanguage()` and `t("docs.gettingStarted.quickInstallTitle")`. Add the same keys to all five locale files when adding or changing doc content. Getting Started is fully translated as a reference.
