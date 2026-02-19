"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

const sectionCards = [
  { href: "/docs/getting-started", labelKey: "docs.card.gettingStarted", descKey: "docs.card.gettingStartedDesc" },
  { href: "/docs/admin", labelKey: "docs.card.admin", descKey: "docs.card.adminDesc" },
  { href: "/docs/features", labelKey: "docs.card.features", descKey: "docs.card.featuresDesc" },
  { href: "/docs/apis", labelKey: "docs.card.apis", descKey: "docs.card.apisDesc" },
  { href: "/docs/deployment", labelKey: "docs.card.deployment", descKey: "docs.card.deploymentDesc" },
];

export default function DocsIntroPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-8 lg:px-10">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {t("docs.welcome")}
      </h1>
      <p className="mt-4 text-lg text-white/80">
        {t("docs.introParagraph")}
      </p>

      <h2 className="mt-10 text-xl font-semibold text-white">
        {t("docs.whereToStart")}
      </h2>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-white/80">
        <li>{t("docs.start1")}</li>
        <li>{t("docs.start2")}</li>
        <li>{t("docs.start3")}</li>
      </ol>

      <h2 className="mt-10 text-xl font-semibold text-white">
        {t("docs.sectionCardsTitle")}
      </h2>
      <p className="mt-2 text-white/70">
        {t("docs.sectionCardsIntro")}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {sectionCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-500/30 hover:bg-white/[0.07]"
          >
            <h3 className="font-semibold text-white group-hover:text-brand-400">
              {t(card.labelKey)}
            </h3>
            <p className="mt-2 text-sm text-white/70">{t(card.descKey)}</p>
            <span className="mt-2 inline-block text-sm font-medium text-brand-400">
              {t("docs.readMore")} →
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-white/10 bg-white/5 p-5">
        <h3 className="font-semibold text-white">{t("docs.tipsTitle")}</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/70">
          <li>{t("docs.tip1")}</li>
          <li>{t("docs.tip2")}</li>
          <li>
            {t("docs.tip3")}{" "}
            <a
              href="https://github.com/Lampx83/AI-Portal"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-400 hover:underline"
            >
              GitHub
            </a>
            .
          </li>
        </ul>
      </div>

      <div className="mt-8 flex items-center gap-2 text-sm text-white/50">
        <span>{t("docs.next")}</span>
        <Link href="/docs/getting-started" className="font-medium text-brand-400 hover:underline">
          {t("docs.nav.gettingStarted")} →
        </Link>
      </div>
    </div>
  );
}
