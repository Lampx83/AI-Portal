"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function AdminPage() {
  return (
    <DocPage
      titleKey="docs.nav.admin"
      nextHref="/docs/features"
      nextLabelKey="docs.nav.features"
    >
      <p>
        The Admin panel is the central place to manage your AI-Portal instance: system settings, agents, applications, users, database, and storage.
      </p>

      <h2>System settings</h2>
      <p>
        Configure language, branding, database, NEXTAUTH_SECRET, Azure AD, OpenAI API key, Qdrant URL, and other options. Values are stored in the database and applied on next load. No manual .env editing required for typical setup.
      </p>

      <h2>Agents</h2>
      <p>
        Register external Agent APIs: add an alias and base URL. Each agent must expose the standard contract (GET /metadata, POST /ask, optional GET /data). Once registered, the agent appears in the sidebar and chat — no frontend code changes needed.
      </p>

      <h2>Applications</h2>
      <p>
        Add applications that follow the standard (GET /metadata). Users can open them from the portal. See <a href="https://github.com/Lampx83/AI-Portal/blob/main/docs/APPLICATIONS.md" target="_blank" rel="noopener noreferrer">docs/APPLICATIONS.md</a> for the contract.
      </p>

      <h2>Users & permissions</h2>
      <p>
        Manage users, roles, and access. The first admin is created during /setup; additional admins can be granted from Admin.
      </p>

      <h2>Database & storage</h2>
      <p>
        Overview of PostgreSQL and optional Qdrant. Backup and restore options are available in Admin for database and file storage.
      </p>
    </DocPage>
  );
}
