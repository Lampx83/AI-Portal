"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function GettingStartedPage() {
  return (
    <DocPage
      titleKey="docs.nav.gettingStarted"
      nextHref="/docs/admin"
      nextLabelKey="docs.nav.admin"
    >
      <h2>Quick install (single command)</h2>
      <p>
        Like Strapi, you can create a new project with one command:
      </p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        npx create-ai-portal@latest
      </pre>
      <p className="mt-3">
        Optionally specify a project folder name:{" "}
        <code>npx create-ai-portal@latest my-portal</code>
      </p>
      <p className="mt-2">
        This downloads the AI-Portal template and can run Docker for you. Open{" "}
        <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">http://localhost:3000</a> → complete <strong>/setup</strong> (app name, icon, database name) → configure the rest in <strong>Admin → System settings</strong>.
      </p>

      <h2>System requirements</h2>
      <ul className="mt-2 space-y-1">
        <li><strong>Git</strong> — to download the code (if not using create-ai-portal)</li>
        <li><strong>Docker</strong> and <strong>Docker Compose</strong> — to run the full stack (PostgreSQL, Qdrant, backend, frontend)</li>
        <li>(Optional) <strong>Node.js 18+</strong> — to run <code>npx create-ai-portal</code> or dev mode without Docker</li>
      </ul>

      <h2>Download the code</h2>
      <p>If you prefer not to use the CLI, clone the repo:</p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        git clone https://github.com/Lampx83/AI-Portal.git{"\n"}cd AI-Portal
      </pre>
      <p className="mt-3">
        You should see <code>backend/</code>, <code>frontend/</code>, and <code>docker-compose.yml</code>. Configuration is done at <strong>/setup</strong> and <strong>Admin → System settings</strong> (no manual .env required).
      </p>

      <h2>Run with Docker Compose</h2>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        docker compose build{"\n"}docker compose up -d
      </pre>
      <ul className="mt-3 space-y-1">
        <li><strong>Frontend:</strong> <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">http://localhost:3000</a></li>
        <li><strong>Backend API:</strong> http://localhost:3001</li>
        <li><strong>PostgreSQL:</strong> port 5432 (internal)</li>
        <li><strong>Qdrant:</strong> port 8010</li>
      </ul>

      <h2>First-time setup (/setup)</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Open http://localhost:3000 → you are redirected to <strong>/setup</strong>.</li>
        <li><strong>Step 1 — Branding:</strong> Enter app name and upload an icon.</li>
        <li><strong>Step 2 — Database:</strong> Confirm or change the Postgres database name, then run init.</li>
        <li><strong>Step 3 — Admin:</strong> Create the first admin user.</li>
        <li>Configure the rest (NEXTAUTH_SECRET, Azure AD, OpenAI key, etc.) in <strong>Admin → System settings</strong>.</li>
      </ol>
    </DocPage>
  );
}
