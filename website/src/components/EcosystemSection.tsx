"use client";

import { useLanguage } from "@/contexts/LanguageContext";

const LAKEFLOW_URL = "https://lake-flow.vercel.app";
const LAKEFLOW_GITHUB = "https://github.com/Lampx83/lakeflow";

export function EcosystemSection() {
  const { t } = useLanguage();

  return (
    <section
      id="ecosystem"
      className="border-b border-white/10 bg-[#070708] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("ecosystem.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            {t("ecosystem.subtitle")}
          </p>
        </div>
        <div className="mt-16">
          <a
            href={LAKEFLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-white/10 bg-[#0a0a0f] p-6 transition hover:border-brand-500/30 hover:bg-white/[0.03] sm:p-8"
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-brand-500/20 px-2 py-0.5 font-mono text-sm font-bold text-brand-400">
                    LakeFlow
                  </span>
                  <span className="text-sm text-white/50">
                    {t("ecosystem.lakeFlow.badge")}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
                  {t("ecosystem.lakeFlow.title")}
                </h3>
                <p className="mt-3 text-white/70">
                  {t("ecosystem.lakeFlow.desc")}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {["ecosystem.lakeFlow.feat1", "ecosystem.lakeFlow.feat2", "ecosystem.lakeFlow.feat3"].map(
                    (key) => (
                      <li
                        key={key}
                        className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/70"
                      >
                        {t(key)}
                      </li>
                    )
                  )}
                </ul>
                <div className="mt-6 flex flex-wrap gap-4">
                  <span className="inline-flex items-center text-sm font-medium text-brand-400 group-hover:text-brand-300">
                    {t("ecosystem.lakeFlow.cta")}
                    <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
                  <a
                    href={LAKEFLOW_GITHUB}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-white/50 hover:text-white/80"
                  >
                    GitHub →
                  </a>
                </div>
              </div>
              <div className="shrink-0 self-center sm:self-auto">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-4xl">
                  📊
                </div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
