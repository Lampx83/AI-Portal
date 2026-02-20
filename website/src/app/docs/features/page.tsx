"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function FeaturesPage() {
  return (
    <DocPage
      titleKey="docs.nav.features"
      nextHref="/docs/creating-assistants"
      nextLabelKey="docs.nav.creatingAssistants"
    >
      <p>
        AI-Portal provides chat, a configurable Central assistant, virtual assistants (agents), and installable applications in a single deployment. You can add optional plugins from Admin → Plugins when needed.
      </p>

      <h2>Chat & Central Assistant</h2>
      <p>
        Built-in chat UI and a Central assistant that you configure in Admin (e.g. connect OpenAI, Gemini, or your own LLM). Users chat in the main view; history is stored per user/project.
      </p>

      <h2>Assistants & Apps</h2>
      <p>
        <strong>Assistants</strong> (agents): each registered Agent has its own alias and endpoint. Users choose an assistant from the sidebar. Implement <code>GET /metadata</code> and <code>POST /ask</code>; register in Admin → Agents. See <a href="/docs/creating-assistants" className="text-brand-400 hover:underline">Creating assistants</a>.
      </p>
      <p>
        <strong>Applications</strong> (apps): installable apps with their own UI. Each app has an alias and base URL. Implement <code>GET /metadata</code>; register in Admin → Applications. See <a href="/docs/creating-apps" className="text-brand-400 hover:underline">Creating apps</a>.
      </p>
      <p>
        Multi-agent workflows are supported: deploy multiple Agent APIs and register them in Admin → Agents.
      </p>

      <h2>Plugins (optional)</h2>
      <p>
        You can install optional plugins from Admin → Plugins when you need extra features (e.g. vector DB, semantic search). The default stack does not include them.
      </p>

      <h2>Self-hosted</h2>
      <p>
        The full stack runs on your infrastructure: Docker Compose for PostgreSQL, MinIO, backend, and frontend. You own the data and the code; no vendor lock-in.
      </p>
    </DocPage>
  );
}
