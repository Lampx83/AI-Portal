"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DeploymentPage() {
  const { t } = useLanguage();

  return (
    <DocPage titleKey="docs.nav.deployment">
      <p>{t("docs.deployment.intro")}</p>

      <h2>{t("docs.deployment.prepareTitle")}</h2>
      <ul className="mt-2 space-y-1">
        <li>{t("docs.deployment.prepareList1")}</li>
        <li>{t("docs.deployment.prepareList2")}</li>
        <li>{t("docs.deployment.prepareList3")}</li>
      </ul>

      <h2>{t("docs.deployment.buildTitle")}</h2>
      <p>{t("docs.deployment.buildIntro")}</p>
      <pre className="code-block mt-3 overflow-x-auto rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-brand-400">
        docker compose build{"\n"}docker compose up -d
      </pre>
      <p className="mt-3">{t("docs.deployment.buildAfter")}</p>

      <h2>{t("docs.deployment.cicdTitle")}</h2>
      <p>{t("docs.deployment.cicdDesc")}</p>

      <p className="mt-8 text-white/60">
        <a href="https://github.com/Lampx83/AI-Portal/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">
          {t("docs.deployment.readmeNote")}
        </a>
      </p>
    </DocPage>
  );
}
