"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

export default function FeaturesPage() {
  const { t } = useLanguage();

  return (
    <DocPage
      titleKey="docs.nav.features"
      nextHref="/docs/creating-assistants"
      nextLabelKey="docs.nav.creatingAssistants"
    >
      <p>{t("docs.features.intro")}</p>

      <h2>{t("docs.features.chatTitle")}</h2>
      <p>{t("docs.features.chatDesc")}</p>

      <h2>{t("docs.features.assistantsTitle")}</h2>
      <p>
        {t("docs.features.assistantsDesc1")}
        <code>GET /metadata</code>
        {t("docs.features.assistantsDesc2")}
        <code>POST /ask</code>
        {t("docs.features.assistantsDesc3")}
        <Link href="/docs/creating-assistants" className="text-brand-400 hover:underline">{t("docs.features.creatingAssistantsLink")}</Link>.
      </p>
      <p>
        {t("docs.features.appsDesc1")}
        <code>GET /metadata</code>
        {t("docs.features.appsDesc2")}
        <Link href="/docs/creating-apps" className="text-brand-400 hover:underline">{t("docs.features.creatingAppsLink")}</Link>
        {t("docs.features.appsDesc3")}
      </p>
      <p>{t("docs.features.multiAgent")}</p>

      <h2>{t("docs.features.pluginsTitle")}</h2>
      <p>{t("docs.features.pluginsDesc")}</p>

      <h2>{t("docs.features.selfHostedTitle")}</h2>
      <p>{t("docs.features.selfHostedDesc")}</p>
    </DocPage>
  );
}
