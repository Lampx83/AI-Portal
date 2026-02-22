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

      <h2>Agent API contract (for developers)</h2>
      <p>
        To register an Agent in <strong>Admin → Agents</strong>, your service must implement these endpoints at <code>{"{base_url}"}</code> (e.g. <code>http://your-server.com:8020</code> — use no trailing slash).
      </p>
      <ul className="mt-2 space-y-1">
        <li><strong>GET {"{base_url}/metadata"}</strong> — Name, description, capabilities, <code>supported_models</code>, <code>sample_prompts</code>, <code>status</code>.</li>
        <li><strong>POST {"{base_url}/ask"}</strong> — Accept prompt and context; return JSON with <code>status: "success"</code> and reply content (see below).</li>
        <li><strong>GET {"{base_url}/data?type=..."}</strong> (optional) — Documents, experts, or other data.</li>
      </ul>

      <h3>POST /ask — Request body (Portal sends)</h3>
      <p className="mb-2">The Portal sends a JSON body with these fields. Your agent must accept them; the most critical for compatibility are listed.</p>
      <table className="w-full border border-white/20 rounded-lg border-collapse my-4 text-sm">
        <thead>
          <tr className="bg-white/5">
            <th className="text-left p-3 border-b border-white/20">Field</th>
            <th className="text-left p-3 border-b border-white/20">Required</th>
            <th className="text-left p-3 border-b border-white/20">Description</th>
          </tr>
        </thead>
        <tbody className="text-white/80">
          <tr><td className="p-3 border-b border-white/10"><code>session_id</code></td><td className="p-3 border-b border-white/10">Yes</td><td className="p-3 border-b border-white/10">Session identifier.</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>model_id</code></td><td className="p-3 border-b border-white/10">Yes</td><td className="p-3 border-b border-white/10">Model ID from your <code>supported_models</code> in metadata.</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>user</code></td><td className="p-3 border-b border-white/10">Yes</td><td className="p-3 border-b border-white/10">User identifier or API URL.</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>prompt</code></td><td className="p-3 border-b border-white/10">Yes</td><td className="p-3 border-b border-white/10">User message.</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>output_type</code></td><td className="p-3 border-b border-white/10">Sent by Portal</td><td className="p-3 border-b border-white/10"><strong>Portal always sends <code>"markdown"</code>.</strong> If your API validates output type, you must accept <code>"markdown"</code> (e.g. do not treat only <code>"text"</code> as valid, or you will get errors like &quot;Invalid output type: text&quot;).</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>context</code></td><td className="p-3 border-b border-white/10">Optional</td><td className="p-3 border-b border-white/10"><code>language</code>, <code>project</code>, <code>extra_data.document</code> (file URLs), <code>history</code> (chat history).</td></tr>
        </tbody>
      </table>

      <h3>POST /ask — Response (your agent must return)</h3>
      <p className="mb-2">Your agent must respond with JSON that the Portal can display. Required:</p>
      <ul className="list-disc pl-6 space-y-1 mb-2">
        <li><code>status</code> = <code>"success"</code></li>
        <li>At least one of: <code>content_markdown</code>, <code>answer</code>, or <code>content</code> (string with the reply). Prefer <code>content_markdown</code> for rich formatting.</li>
      </ul>
      <p className="mb-2">Example success response:</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10">
{`{
  "status": "success",
  "content_markdown": "## Answer\\nYour reply here..."
}`}
      </pre>
      <p className="mt-3 text-amber-200/90">
        If your agent returns a non-success status or missing content, the Portal will show &quot;Agent error&quot; to the user. Ensure your base URL has no trailing slash (e.g. <code>http://host:8020</code> not <code>http://host:8020/</code>) to avoid 404 on <code>/ask</code>.
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
