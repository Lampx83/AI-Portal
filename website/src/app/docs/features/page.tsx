"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function FeaturesPage() {
  return (
    <DocPage
      titleKey="docs.nav.features"
      nextHref="/docs/apis"
      nextLabelKey="docs.nav.apis"
    >
      <p>
        AI-Portal provides chat, a configurable Central assistant, virtual assistants (agents), and RAG (retrieval-augmented generation) in a single deployment.
      </p>

      <h2>Chat & Central Assistant</h2>
      <p>
        Built-in chat UI and a Central assistant that you configure in Admin (e.g. connect OpenAI, Gemini, or your own LLM). Users chat in the main view; history is stored per user/project.
      </p>

      <h2>Virtual Assistants & Agents</h2>
      <p>
        Each registered Agent has its own alias and endpoint. Users can choose an assistant from the sidebar. Multi-agent workflows are supported: you can deploy multiple Agent APIs and register them in Admin → Agents. The Agent contract is: <code>GET /metadata</code>, <code>POST /ask</code>, and optionally <code>GET /data</code> for state.
      </p>

      <h2>RAG & Knowledge</h2>
      <p>
        Use Qdrant as the vector store and your own data for retrieval-augmented generation. Configure Qdrant URL and related options in Admin → System settings. Ingest documents and run semantic search from the API or from the Central assistant when enabled.
      </p>

      <h2>Self-hosted</h2>
      <p>
        The full stack runs on your infrastructure: Docker Compose for PostgreSQL, Qdrant, backend, and frontend. You own the data and the code; no vendor lock-in.
      </p>
    </DocPage>
  );
}
