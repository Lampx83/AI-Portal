"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { useBranding } from "@/contexts/branding-context"
import { getLocaleLabel } from "@/lib/i18n"
import {
  RESEARCH_CONTACT_EMAIL,
  RESEARCH_ITEMS,
  RESEARCH_SECTION_ID,
  systemDisplayName,
} from "@/lib/research-terms"

/**
 * Chính sách quyền riêng tư — trang công khai, đứng ngoài (dashboard) nên không có sidebar
 * và xem được khi chưa đăng nhập. Hiện chỉ có mục đã duyệt: sử dụng dữ liệu cho nghiên cứu (#nghien-cuu).
 * Locale zh/hi/es chưa dịch → t() tự lấy bản EN.
 */
export default function PrivacyPolicyPage() {
  const { t, locale, setLocale, publicLocales } = useLanguage()
  const { branding } = useBranding()
  const systemName = systemDisplayName(branding.systemName, t)
  const contactEmail = RESEARCH_CONTACT_EMAIL ?? t("privacy.contactPlaceholder")
  const fill = (s: string) => s.replace("{systemName}", systemName).replace("{contactEmail}", contactEmail)

  // Nội dung render phía client nên trình duyệt có thể chưa cuộn tới #nghien-cuu lúc tải trang.
  useEffect(() => {
    if (window.location.hash !== `#${RESEARCH_SECTION_ID}`) return
    const id = window.setTimeout(() => document.getElementById(RESEARCH_SECTION_ID)?.scrollIntoView({ block: "start" }), 50)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link href="/welcome" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("privacy.backHome")}
          </Link>
          {publicLocales.length > 1 && (
            <div role="group" aria-label={t("privacy.languageLabel")} className="inline-flex flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-0.5 text-xs font-medium dark:border-gray-800 dark:bg-gray-900">
              {publicLocales.map((code) => (
                <button
                  key={code}
                  type="button"
                  lang={code}
                  aria-pressed={code === String(locale)}
                  onClick={() => setLocale(code)}
                  className={
                    code === String(locale)
                      ? "rounded-full bg-brand px-3 py-1 text-white"
                      : "rounded-full px-3 py-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }
                >
                  {getLocaleLabel(code)}
                </button>
              ))}
            </div>
          )}
        </div>

        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("privacy.title")}</h1>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 sm:text-base">{fill(t("privacy.intro"))}</p>
        </header>

        <section
          id={RESEARCH_SECTION_ID}
          aria-labelledby={`${RESEARCH_SECTION_ID}-heading`}
          className="scroll-mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7"
        >
          <h2 id={`${RESEARCH_SECTION_ID}-heading`} className="text-lg font-semibold tracking-tight sm:text-xl">
            <a href={`#${RESEARCH_SECTION_ID}`} className="hover:underline">
              {t("privacy.research.heading")}
            </a>
          </h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed marker:font-semibold">
            {RESEARCH_ITEMS.map((item) => (
              <li key={item} className="pl-1">
                <strong className="font-semibold text-gray-900 dark:text-white">{t(`privacy.research.${item}.title`)}</strong>{" "}
                {fill(t(`privacy.research.${item}.body`))}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}
