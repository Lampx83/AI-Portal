"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function DeploymentPage() {
  return (
    <DocPage titleKey="docs.nav.deployment">
      <p>
        Deploy AI-Portal to a server (VPS or cloud) so users can access it via a domain (e.g. <code>https://your-domain.com</code>).
      </p>

      <h2>Prepare the server</h2>
      <ul className="mt-2 space-y-1">
        <li>Install Docker and Docker Compose.</li>
        <li>Open ports 80/443 for the frontend (and optionally 3001 for direct API access if needed).</li>
        <li>Set up a reverse proxy (e.g. Nginx or Caddy) for HTTPS and proxy to the frontend container.</li>
      </ul>

      <h2>Build and run</h2>
      <p>
        Clone or copy the project to the server, then:
      </p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        docker compose build{"\n"}docker compose up -d
      </pre>
      <p className="mt-3">
        Configure environment (e.g. <code>NEXTAUTH_URL</code>, <code>NEXTAUTH_SECRET</code>) via Admin → System settings or via environment variables passed to the containers. For production, use a strong <code>NEXTAUTH_SECRET</code> and HTTPS.
      </p>

      <h2>CI/CD (optional)</h2>
      <p>
        You can use GitHub Actions or another CI to build and push Docker images, then deploy to your server (e.g. pull latest and <code>docker compose up -d</code>). The repo may include example workflows; adapt them to your environment.
      </p>

      <p className="mt-8 text-white/60">
        For detailed steps and server setup, see the{" "}
        <a href="https://github.com/Lampx83/AI-Portal/blob/main/README.md" target="_blank" rel="noopener noreferrer">README</a> on GitHub.
      </p>
    </DocPage>
  );
}
