"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";

export default function APIsPage() {
  const { t } = useLanguage();

  return (
    <DocPage
      titleKey="docs.nav.apis"
      nextHref="/docs/deployment"
      nextLabelKey="docs.nav.deployment"
    >
      <p>{t("docs.apis.intro")}</p>

      <h2>{t("docs.apis.agentTitle")}</h2>
      <p>{t("docs.apis.agentDesc")}</p>
      <ul className="mt-2 space-y-1">
        <li><strong>GET {"{base_url}/metadata"}</strong> — {t("docs.apis.agentList1")}</li>
        <li><strong>POST {"{base_url}/ask"}</strong> — {t("docs.apis.agentList2")}</li>
        <li><strong>GET {"{base_url}/data?type=..."}</strong> (optional) — {t("docs.apis.agentList3")}</li>
      </ul>

      <h3>{t("docs.apis.askRequestTitle")}</h3>
      <p className="mb-2">{t("docs.apis.askRequestDesc")}</p>
      <table className="w-full border border-white/20 rounded-lg border-collapse my-4 text-sm">
        <thead>
          <tr className="bg-white/5">
            <th className="text-left p-3 border-b border-white/20">{t("docs.apis.tableField")}</th>
            <th className="text-left p-3 border-b border-white/20">{t("docs.apis.tableRequired")}</th>
            <th className="text-left p-3 border-b border-white/20">{t("docs.apis.tableDescription")}</th>
          </tr>
        </thead>
        <tbody className="text-white/80">
          <tr><td className="p-3 border-b border-white/10"><code>session_id</code></td><td className="p-3 border-b border-white/10">{t("docs.apis.tableYes")}</td><td className="p-3 border-b border-white/10">{t("docs.apis.tableSessionId")}</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>model_id</code></td><td className="p-3 border-b border-white/10">{t("docs.apis.tableYes")}</td><td className="p-3 border-b border-white/10">{t("docs.apis.tableModelId")}</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>user</code></td><td className="p-3 border-b border-white/10">{t("docs.apis.tableYes")}</td><td className="p-3 border-b border-white/10">{t("docs.apis.tableUser")}</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>prompt</code></td><td className="p-3 border-b border-white/10">{t("docs.apis.tableYes")}</td><td className="p-3 border-b border-white/10">{t("docs.apis.tablePrompt")}</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>output_type</code></td><td className="p-3 border-b border-white/10">{t("docs.apis.tableSentByPortal")}</td><td className="p-3 border-b border-white/10">{t("docs.apis.tableOutputType")}</td></tr>
          <tr><td className="p-3 border-b border-white/10"><code>context</code></td><td className="p-3 border-b border-white/10">{t("docs.apis.tableOptional")}</td><td className="p-3 border-b border-white/10">{t("docs.apis.tableContext")}</td></tr>
        </tbody>
      </table>

      <h3>{t("docs.apis.askResponseTitle")}</h3>
      <p className="mb-2">{t("docs.apis.askResponseDesc")}</p>
      <ul className="list-disc pl-6 space-y-1 mb-2">
        <li><code>status</code> = <code>"success"</code></li>
        <li>{t("docs.apis.askResponseList2")}</li>
      </ul>
      <p className="mb-2">{t("docs.apis.exampleSuccess")}</p>
      <pre className="bg-black/30 rounded-lg p-4 text-sm overflow-x-auto border border-white/10">
{`{
  "status": "success",
  "content_markdown": "## Answer\\nYour reply here..."
}`}
      </pre>
      <p className="mt-3 text-amber-200/90">{t("docs.apis.agentErrorNote")}</p>

      <h2>{t("docs.apis.applicationTitle")}</h2>
      <p>{t("docs.apis.applicationDesc")}</p>

      <h2>{t("docs.apis.backendTitle")}</h2>
      <p>{t("docs.apis.backendDesc")}</p>
    </DocPage>
  );
}
