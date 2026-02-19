"use client";

import { useLanguage } from "@/contexts/LanguageContext";

const featureKeys = [
  { title: "product.f1Title", desc: "product.f1Desc", icon: "💬" },
  { title: "product.f2Title", desc: "product.f2Desc", icon: "🤖" },
  { title: "product.f3Title", desc: "product.f3Desc", icon: "📚" },
  { title: "product.f4Title", desc: "product.f4Desc", icon: "🔒" },
  { title: "product.f5Title", desc: "product.f5Desc", icon: "⚙️" },
  { title: "product.f6Title", desc: "product.f6Desc", icon: "🛠️" },
];

export function ProductSection() {
  const { t } = useLanguage();

  return (
    <section
      id="product"
      className="border-b border-white/10 bg-[#0a0a0f] px-4 py-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t("product.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
            {t("product.subtitle")}
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {featureKeys.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-brand-500/30 hover:bg-white/[0.07]"
            >
              <div className="text-2xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {t(feature.title)}
              </h3>
              <p className="mt-2 text-sm text-white/70">
                {t(feature.desc)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
