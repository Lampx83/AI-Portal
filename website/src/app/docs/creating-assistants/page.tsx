"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CreatingAssistantsPage() {
  const { t } = useLanguage();

  return (
    <DocPage
      titleKey="docs.nav.creatingAssistants"
      nextHref="/docs/apis"
      nextLabelKey="docs.nav.apis"
    >
      <p>{t("docs.creatingAssistants.intro")}</p>

      <h2>{t("docs.creatingAssistants.requiredEndpoints")}</h2>
      <table className="w-full border border-white/20 rounded-lg border-collapse my-4 text-sm">
        <thead>
          <tr className="bg-white/5">
            <th className="text-left p-3 border-b border-white/20">{t("docs.creatingAssistants.thEndpoint")}</th>
            <th className="text-left p-3 border-b border-white/20">{t("docs.creatingAssistants.thDescription")}</th>
          </tr>
        </thead>
        <tbody className="text-white/80">
          <tr><td className="p-3 border-b border-white/10"><code>GET {"{base_url}/metadata"}</code></td><td className="p-3 border-b border-white/10">{t("docs.creatingAssistants.metadataDesc")}</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>POST {"{base_url}/ask"}</code></td><td className="p-3 border-b border-white/10">{t("docs.creatingAssistants.askDesc")}</td></tr>
          <tr><td className="p-3"><code>GET {"{base_url}/data"}</code></td><td className="p-3">{t("docs.creatingAssistants.dataDesc")}</td></tr>
        </tbody>
      </table>

      <h2>{t("docs.creatingAssistants.getMetadataTitle")}</h2>
      <p>{t("docs.creatingAssistants.getMetadataReturn")}</p>
      <p className="mt-2 text-sm text-white/70">{t("docs.creatingAssistants.exampleCall")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`curl -s http://your-server:8020/metadata`}
      </pre>
      <p className="mt-3 text-sm text-white/70">{t("docs.creatingAssistants.exampleResponse")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`{
  "name": "Document Assistant",
  "description": "Search and summarize documents",
  "capabilities": ["search", "summarize"],
  "supported_models": [
    { "model_id": "gpt-4o-mini", "name": "GPT-4o Mini", "accepted_file_types": ["pdf", "docx"] }
  ],
  "sample_prompts": ["Summarize an article about AI"],
  "provided_data_types": [{ "type": "documents", "description": "List of documents" }],
  "status": "active"
}`}
      </pre>

      <h2>{t("docs.creatingAssistants.postAskTitle")}</h2>
      <p>{t("docs.creatingAssistants.requestBodyIntro")}</p>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li><code>output_type</code> — {t("docs.creatingAssistants.outputTypeNote")}</li>
        <li><code>context</code> — {t("docs.creatingAssistants.contextNote")}</li>
      </ul>
      <p className="mt-3">{t("docs.creatingAssistants.responseIntro")}</p>
      <p className="mt-2 text-amber-200/90">{t("docs.creatingAssistants.baseUrlNote")}</p>
      <p className="mt-3 text-sm text-white/70">{t("docs.creatingAssistants.exampleCall")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`curl -X POST 'http://your-server:8020/ask' \\
  -H 'Content-Type: application/json' \\
  -d '{"session_id":"test-123","model_id":"gpt-4o-mini","user":"admin-test","prompt":"Hello","output_type":"markdown","context":{}}'`}
      </pre>
      <p className="mt-3 text-sm text-white/70">{t("docs.creatingAssistants.exampleRequestBody")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "model_id": "gpt-4o-mini",
  "user": "https://portal.example.com/api/users/email/user@example.com",
  "prompt": "Summarize this document",
  "output_type": "markdown",
  "context": {
    "language": "en",
    "extra_data": { "document": ["https://.../file.pdf"] },
    "history": []
  }
}`}
      </pre>
      <p className="mt-3 text-sm text-white/70">{t("docs.creatingAssistants.exampleAskResponse")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`{
  "status": "success",
  "content_markdown": "## Summary\\n\\nSummary content here..."
}`}
      </pre>

      <h2>{t("docs.creatingAssistants.getDataTitle")}</h2>
      <p>{t("docs.creatingAssistants.getDataWhen")}</p>
      <p className="mt-2 text-sm text-white/70">{t("docs.creatingAssistants.exampleCall")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`curl -s 'http://your-server:8020/data?type=documents'`}
      </pre>
      <p className="mt-3 text-sm text-white/70">{t("docs.creatingAssistants.exampleDataResponse")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`{
  "status": "success",
  "data_type": "documents",
  "items": [
    { "id": "1", "title": "Document A", "url": "https://..." },
    { "id": "2", "title": "Document B", "url": "https://..." }
  ]
}`}
      </pre>

      <h2>4. Huong dan cho dev: tao Tools va gan vao tro ly</h2>
      <p>
        Goi y thuc te la tach phan xu ly thanh cac Tool nho, sau do endpoint
        <code>/ask</code> se goi Tool tuong ung theo y dinh cua nguoi dung.
        Cach nay giup de test, de debug va tai su dung trong nhieu tro ly.
      </p>
      <ol className="list-decimal pl-6 mt-2 space-y-1">
        <li>Viet tung Tool thanh ham don (input JSON, output JSON ro rang).</li>
        <li>Viet lop hoac ham <code>toolManifest</code> de mo ta schema input.</li>
        <li>Trong <code>POST /ask</code>, map prompt hoac intent sang Tool can goi.</li>
        <li>Tra ket qua ve <code>content_markdown</code> cho AI-Portal render.</li>
      </ol>

      <h3>4.1 Mau Tool HelloWorld (TypeScript)</h3>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`export function helloWorldTool(input: { name?: string; language?: "vi" | "en" } = {}) {
  const finalName = input.name?.trim() || "developer";
  const language = input.language ?? "vi";
  const greeting = language === "en" ? \`Hello, \${finalName}!\` : \`Xin chao, \${finalName}!\`;

  return {
    ok: true,
    message: \`\${greeting} This response comes from helloWorldTool.\`
  };
}`}
      </pre>

      <h3>4.2 Gan Tool vao endpoint /ask</h3>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`app.post("/ask", async (req, res) => {
  const { prompt } = req.body;

  if (prompt?.toLowerCase().includes("hello")) {
    const toolResult = helloWorldTool({ name: "AI-Portal user", language: "vi" });
    return res.json({
      status: "success",
      content_markdown: \`## Tool result\\n\\n\${toolResult.message}\`
    });
  }

  return res.json({
    status: "success",
    content_markdown: "Khong tim thay Tool phu hop cho prompt nay."
  });
});`}
      </pre>

      <h3>4.3 Dong goi Tool bang Vite (library mode)</h3>
      <p>
        Voi Tool viet bang TypeScript, ban co the dung Vite de build file phan
        phoi gon nhe:
      </p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10 mt-1">
{`npm install
npm run build
npm run pack:tgz`}
      </pre>
      <p>
        Trong mau ben duoi, <code>vite.config.ts</code> da duoc cau hinh o
        che do <code>build.lib</code> de xuat ra file <code>.mjs</code> hoac
        <code>.umd.js</code>.
      </p>

      <h3>4.4 Tai bo mau HelloWorld Tool</h3>
      <ul className="list-disc pl-6 mt-2 space-y-1">
        <li>
          <a href="/downloads/tools/hello-world-tool-vite.zip" download>
            Tai hello-world-tool-vite.zip
          </a>
          {" — "}Mau chao don co schema input, build ra ESM va UMD.
        </li>
        <li>
          <a href="/downloads/tools/hello-time-tool-vite.zip" download>
            Tai hello-time-tool-vite.zip
          </a>
          {" — "}Mau tra ve thoi gian hien tai theo timezone.
        </li>
        <li>
          Xem source truc tiep:
          {" "}
          <a href="/downloads/tools-src/hello-world-tool-vite/README.md">
            hello-world-tool-vite
          </a>
          {", "}
          <a href="/downloads/tools-src/hello-time-tool-vite/README.md">
            hello-time-tool-vite
          </a>
          .
        </li>
      </ul>

      <h2>{t("docs.creatingAssistants.regTitle")}</h2>
      <p>{t("docs.creatingAssistants.regPara")}</p>
      <p>{t("docs.creatingAssistants.regPara2")}</p>
    </DocPage>
  );
}
