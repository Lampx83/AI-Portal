"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

export default function CreatingAppsPage() {
  const { t } = useLanguage();

  return (
    <DocPage
      titleKey="docs.nav.creatingApps"
      nextHref="/docs/creating-assistants"
      nextLabelKey="docs.nav.creatingAssistants"
    >
      <p>{t("docs.creatingApps.intro")}</p>

      <h2>{t("docs.creatingApps.requiredTitle")}</h2>
      <p>
        <strong>GET <code>{"{base_url}/metadata"}</code></strong> — {t("docs.creatingApps.requiredDesc")}
      </p>
      <ul className="list-disc pl-6 space-y-1 text-white/80">
        <li><code>name</code> {t("docs.creatingApps.requiredList1")}</li>
        <li><code>description</code>: {t("docs.creatingApps.requiredList2")}</li>
        <li><code>version</code>, <code>developer</code>, <code>capabilities</code>, <code>status</code>: {t("docs.creatingApps.requiredList3")}</li>
      </ul>
      <p className="mt-2">{t("docs.creatingApps.exampleResponse")}</p>
      <pre className="mt-2 p-4 rounded-lg bg-white/5 border border-white/10 text-sm overflow-x-auto">
{`{
  "name": "My App",
  "description": "Document processing",
  "capabilities": ["upload", "export"],
  "status": "active"
}`}
      </pre>
      <p>{t("docs.creatingApps.portalCalls")}</p>

      <h2>{t("docs.creatingApps.regTitle")}</h2>
      <ol className="list-decimal pl-6 space-y-2 text-white/80">
        <li>{t("docs.creatingApps.regStep1")}</li>
        <li>{t("docs.creatingApps.regStep2")}</li>
      </ol>

      <h2>{t("docs.creatingApps.chatTitle")}</h2>
      <p>
        {t("docs.creatingApps.chatDesc")}
        <Link href="/docs/creating-assistants" className="text-brand-400 hover:underline">{t("docs.creatingApps.agentContract")}</Link>
        {t("docs.creatingApps.chatDesc2")}
      </p>
    </DocPage>
  );
}
