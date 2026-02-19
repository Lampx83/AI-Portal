"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function CreatingAppsPage() {
  return (
    <DocPage
      titleKey="docs.nav.creatingApps"
      nextHref="/docs/creating-assistants"
      nextLabelKey="docs.nav.creatingAssistants"
    >
      <p>
        Applications (apps) are installable modules with their own UI. Register them in <strong>Admin → Applications</strong>. After adding alias, base URL, and icon, the app appears in the portal sidebar. Only one endpoint is required.
      </p>

      <h2>Required endpoint</h2>
      <p>
        <strong>GET <code>{"{base_url}/metadata"}</code></strong> — Return JSON:
      </p>
      <ul className="list-disc pl-6 space-y-1 text-white/80">
        <li><code>name</code> (required): display name</li>
        <li><code>description</code>: short description</li>
        <li><code>version</code>, <code>developer</code>, <code>capabilities</code>, <code>status</code>: optional</li>
      </ul>
      <p className="mt-2">
        Example response:
      </p>
      <pre className="mt-2 p-4 rounded-lg bg-white/5 border border-white/10 text-sm overflow-x-auto">
{`{
  "name": "My App",
  "description": "Document processing",
  "capabilities": ["upload", "export"],
  "status": "active"
}`}
      </pre>
      <p>
        The portal calls <code>/metadata</code> to show the name and check status (healthy/unhealthy).
      </p>

      <h2>Registration</h2>
      <ol className="list-decimal pl-6 space-y-2 text-white/80">
        <li>Deploy a server that exposes <strong>GET {"{base_url}/metadata"}</strong>.</li>
        <li>Admin → <strong>Applications</strong> → Add: <strong>alias</strong>, <strong>base_url</strong>, <strong>icon</strong> (e.g. FileText, Database, Bot), <strong>is_active</strong>, <strong>display_order</strong>.</li>
        <li>(Optional) Set <strong>domain_url</strong> if the app is a separate SPA; the portal can open it in an iframe or new tab.</li>
      </ol>

      <h2>Optional: chat integration</h2>
      <p>
        If the app also participates in chat, implement <code>POST /ask</code> and <code>GET /data</code> per the <a href="/docs/creating-assistants" className="text-brand-400 hover:underline">Agent contract</a>. Otherwise, only <code>/metadata</code> is required to register an application.
      </p>
    </DocPage>
  );
}
