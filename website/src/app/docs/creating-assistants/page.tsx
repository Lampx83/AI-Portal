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
        Assistants (agents) are chat backends that you implement and register in <strong>Admin → Agents</strong>. Each has an alias and <strong>base URL</strong> (e.g. <code>http://your-server.com:8020</code> — no trailing slash). Users choose an assistant from the sidebar; the portal provides the chat UI, embed, and multi-language.
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
          <tr><td className="p-3 border-b border-white/10"><code>POST {"{base_url}/ask"}</code></td><td className="p-3 border-b border-white/10">Accept prompt + context; return <code>status: "success"</code> and <code>content_markdown</code> (or <code>answer</code>/<code>content</code>)</td></tr>
          <tr><td className="p-3"><code>GET {"{base_url}/data"}</code></td><td className="p-3">Optional. Return data (e.g. documents, experts) for <code>?type=...</code></td></tr>
        </tbody>
      </table>

      <h2>GET /metadata</h2>
      <p>
        Return JSON with at least <code>name</code>; recommended: <code>description</code>, <code>capabilities</code>, <code>supported_models</code> (array of <code>{"{ model_id, name, accepted_file_types }"}</code>), <code>sample_prompts</code>, <code>status</code> (<code>"active"</code> | <code>"inactive"</code>).
      </p>

      <h2>POST /ask — Request and response (important for developers)</h2>
      <p>
        <strong>Request body</strong> the Portal sends: <code>session_id</code>, <code>model_id</code>, <code>user</code>, <code>prompt</code>, <code>output_type</code>, and <code>context</code>.
      </p>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li><code>output_type</code> — The Portal always sends <code>"markdown"</code>. If your agent API validates output type, it must accept <code>"markdown"</code>. Using only <code>"text"</code> as valid will cause errors (e.g. &quot;Invalid output type: text&quot;) when users chat from the portal.</li>
        <li><code>context</code> — May include <code>language</code>, <code>project</code>, <code>extra_data.document</code> (file URLs), <code>history</code> (previous messages).</li>
      </ul>
      <p className="mt-3">
        <strong>Response</strong> your agent must return: JSON with <code>status: "success"</code> and at least one of <code>content_markdown</code>, <code>answer</code>, or <code>content</code> (string). Prefer <code>content_markdown</code> for rich display. Without these, the Portal shows &quot;Agent error&quot; to the user.
      </p>
      <p className="mt-2 text-amber-200/90">
        <strong>Base URL:</strong> Use no trailing slash (e.g. <code>http://host:8020</code>). A trailing slash can cause 404 on <code>/ask</code> when the portal calls your agent.
      </p>

      <h2>Registration & testing</h2>
      <p>
        Admin → <strong>Agents</strong> → Add: <strong>alias</strong> (e.g. <code>papers</code>), <strong>base URL</strong>, <strong>icon</strong>. You can set a <strong>routing hint</strong> so the Central assistant selects this agent when the user does not choose one. Use <strong>Test API</strong> in Admin to send a sample request.
      </p>
      <p>
        Full request/response examples and system APIs (user, project) that the portal sends in context: <code>frontend/docs/README.md</code> (Agent API) and <code>docs/DEVELOPERS.md</code> in the repository.
      </p>
    </DocPage>
  );
}
