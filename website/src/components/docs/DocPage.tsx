"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

type DocPageProps = {
  titleKey: string;
  children: React.ReactNode;
  nextHref?: string;
  nextLabelKey?: string;
};

export function DocPage({
  titleKey,
  children,
  nextHref,
  nextLabelKey,
}: DocPageProps) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:px-8 lg:px-10">
      <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {t(titleKey)}
      </h1>
      <div className="docs-prose mt-8 text-white/80 [&_a]:text-brand-400 [&_a]:hover:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-white [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-white [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
      {nextHref && nextLabelKey && (
        <div className="mt-12 flex items-center gap-2 border-t border-white/10 pt-8 text-sm text-white/50">
          <span>{t("docs.next")}</span>
          <Link href={nextHref} className="font-medium text-brand-400 hover:underline">
            {t(nextLabelKey)} →
          </Link>
        </div>
      )}
    </div>
  );
}
