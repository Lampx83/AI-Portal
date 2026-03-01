"use client";

import { DocPage } from "@/components/docs/DocPage";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";

export default function AdminPage() {
  const { t } = useLanguage();

  return (
    <DocPage
      titleKey="docs.nav.admin"
      nextHref="/docs/features"
      nextLabelKey="docs.nav.features"
    >
      <p>{t("docs.admin.intro")}</p>

      <h2>{t("docs.admin.systemTitle")}</h2>
      <p>{t("docs.admin.systemDesc")}</p>

      <h2>{t("docs.admin.agentsTitle")}</h2>
      <p>{t("docs.admin.agentsDesc")}</p>

      <h2>{t("docs.admin.applicationsTitle")}</h2>
      <p>
        {t("docs.admin.applicationsDesc")}
        <Link href="/docs/creating-apps" className="text-brand-400 hover:underline">{t("docs.admin.creatingAppsLink")}</Link>
        {t("docs.admin.applicationsDesc2")}
      </p>

      <h2>{t("docs.admin.usersTitle")}</h2>
      <p>{t("docs.admin.usersDesc")}</p>

      <h2>{t("docs.admin.databaseTitle")}</h2>
      <p>{t("docs.admin.databaseDesc")}</p>
    </DocPage>
  );
}
