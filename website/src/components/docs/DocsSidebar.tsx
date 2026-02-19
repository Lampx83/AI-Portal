"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

const navItems: { href: string; labelKey: string }[] = [
  { href: "/docs", labelKey: "docs.nav.intro" },
  { href: "/docs/getting-started", labelKey: "docs.nav.gettingStarted" },
  { href: "/docs/admin", labelKey: "docs.nav.admin" },
  { href: "/docs/features", labelKey: "docs.nav.features" },
  { href: "/docs/creating-apps", labelKey: "docs.nav.creatingApps" },
  { href: "/docs/creating-assistants", labelKey: "docs.nav.creatingAssistants" },
  { href: "/docs/apis", labelKey: "docs.nav.apis" },
  { href: "/docs/deployment", labelKey: "docs.nav.deployment" },
];

export function DocsSidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="w-56 shrink-0 border-r border-white/10 bg-[#070708]/80">
      <nav className="sticky top-20 flex flex-col gap-0.5 py-6 pl-6 pr-3">
        <Link
          href="/docs"
          className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50"
        >
          {t("docs.nav.docs")}
        </Link>
        {navItems.map((item) => {
          const isActive =
            item.href === "/docs"
              ? pathname === "/docs"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-brand-500/20 font-medium text-brand-400"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
