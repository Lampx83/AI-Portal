"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function APIsPage() {
  return (
    <DocPage
      titleKey="docs.nav.apis"
      nextHref="/docs/deployment"
      nextLabelKey="docs.nav.deployment"
    >
      <p>
        AI-Portal exposes REST APIs for chat, agents, and applications. The backend runs on port 3001 by default.
      </p>

      <h2>Agent API contract</h2>
      <p>
        To register an Agent in Admin, your service must implement:
      </p>
      <ul className="mt-2 space-y-1">
        <li><strong>GET /metadata</strong> — returns agent name, description, and capabilities.</li>
        <li><strong>POST /ask</strong> — receives user message and context; returns assistant reply (streaming or JSON).</li>
        <li><strong>GET /data</strong> (optional) — returns current conversation or state for the client.</li>
      </ul>
      <p className="mt-3">
        See <a href="https://github.com/Lampx83/AI-Portal/tree/main/frontend/docs" target="_blank" rel="noopener noreferrer">frontend/docs</a> for the detailed contract and examples.
      </p>

      <h2>Application API</h2>
      <p>
        Applications follow a similar metadata contract (GET /metadata). Register the base URL in Admin → Applications so users can open the app from the portal.
      </p>

      <h2>Backend APIs</h2>
      <p>
        The AI-Portal backend provides REST endpoints for authentication, chat, agents, projects, and admin operations. These are used by the frontend; for custom integrations you can call them with the same authentication (session or API token as configured).
      </p>
    </DocPage>
  );
}
