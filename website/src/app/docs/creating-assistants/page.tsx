"use client";

import { DocPage } from "@/components/docs/DocPage";

export default function CreatingAssistantsPage() {
  return (
    <DocPage
      titleKey="docs.nav.creatingAssistants"
      nextHref="/docs/apis"
      nextLabelKey="docs.nav.apis"
    >
      <p>
        Assistants (agents) are chat backends that you implement and register in <strong>Admin → Agents</strong>. Each has an alias and base URL. Users choose an assistant from the sidebar; the portal provides the chat UI, embed, and multi-language. Implement two required endpoints and optionally a third.
      </p>

      <h2>Required endpoints</h2>
      <table className="w-full border border-white/20 rounded-lg border-collapse my-4 text-sm">
        <thead>
          <tr className="bg-white/5">
            <th className="text-left p-3 border-b border-white/20">Endpoint</th>
            <th className="text-left p-3 border-b border-white/20">Description</th>
          </tr>
        </thead>
        <tbody className="text-white/80">
          <tr><td className="p-3 border-b border-white/10"><code>GET {"{base_url}/metadata"}</code></td><td className="p-3 border-b border-white/10">Name, description, capabilities, supported_models, sample_prompts, status</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>POST {"{base_url}/ask"}</code></td><td className="p-3 border-b border-white/10">Accept prompt + context; return Markdown content (<code>content_markdown</code> or <code>answer</code>)</td></tr>
          <tr><td className="p-3"><code>GET {"{base_url}/data"}</code></td><td className="p-3">Optional. Return data (e.g. documents, experts) for <code>?type=...</code></td></tr>
        </tbody>
      </table>

      <h2>GET /metadata</h2>
      <p>
        Return JSON with at least <code>name</code>; recommended: <code>description</code>, <code>capabilities</code>, <code>supported_models</code> (array of <code>{"{ model_id, name, accepted_file_types }"}</code>), <code>sample_prompts</code>, <code>status</code> (<code>"active"</code> | <code>"inactive"</code>).
      </p>

      <h2>POST /ask</h2>
      <p>
        Request body: <code>session_id</code>, <code>model_id</code>, <code>user</code> (API URL), <code>prompt</code>, and <code>context</code> (e.g. <code>language</code>, <code>project</code>, <code>extra_data.document</code>, <code>history</code>). Response: include <code>content_markdown</code>, <code>answer</code>, or <code>content</code>; optional <code>sources</code>, <code>attachments</code>.
      </p>

      <h2>Registration & testing</h2>
      <p>
        Admin → <strong>Agents</strong> → Add: <strong>alias</strong> (e.g. <code>papers</code>), <strong>base URL</strong>, <strong>icon</strong>. You can set a <strong>routing hint</strong> so the Central assistant selects this agent when the user does not choose one. Use <strong>Test API</strong> in Admin to send a sample request.
      </p>
      <p>
        For full request/response examples and system APIs (user, project) that the portal sends in context, see the repository: <code>frontend/docs/README.md</code> (Agent API) and <code>docs/DEVELOPERS.md</code>.
      </p>
    </DocPage>
  );
}
