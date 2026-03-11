"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect, useMemo } from "react"
import { useTools } from "@/hooks/use-tools"
import { useLanguage } from "@/contexts/language-context"
import { Skeleton } from "@/components/ui/skeleton"
import { FolderOpen, GraduationCap, Grid3X3, Timer, Gamepad, Wrench, ArrowLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Assistant } from "@/lib/assistants"
import { fetchCategories, type ToolCategory } from "@/lib/api/tools-api"

const DEFAULT_CATEGORY_SLUG = "general"

function groupToolsByCategory(tools: Assistant[], categoryOrder: string[]): Record<string, Assistant[]> {
  const groups: Record<string, Assistant[]> = {}
  for (const slug of categoryOrder) {
    groups[slug] = []
  }
  for (const tool of tools) {
    const slug = (tool.category_slug ?? DEFAULT_CATEGORY_SLUG).toLowerCase()
    if (!groups[slug]) groups[slug] = []
    groups[slug].push(tool)
  }
  return groups
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  research: FolderOpen,
  education: GraduationCap,
  productivity: Timer,
  games: Gamepad,
  utilities: Wrench,
  general: Grid3X3,
}

export function ToolsSidebar() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useLanguage()
  const { tools, loading } = useTools()
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState<ToolCategory[]>([])

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((list) => {
        if (!cancelled) setCategories(list)
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categoryOrder = useMemo(
    () => (categories.length > 0 ? categories.map((c) => c.slug.toLowerCase()) : [DEFAULT_CATEGORY_SLUG]),
    [categories]
  )
  const categoryLabels = useMemo(() => {
    const out: Record<string, string> = {}
    for (const c of categories) {
      out[c.slug.toLowerCase()] = c.name
    }
    out[DEFAULT_CATEGORY_SLUG] = out[DEFAULT_CATEGORY_SLUG] ?? t("tools.store.categoryGeneral")
    return out
  }, [categories, t])

  const alias = typeof params?.alias === "string" ? params.alias : (params?.alias as string[])?.[0]
  const isToolOpen = !!alias?.trim()
  const openToolAlias = alias?.trim().toLowerCase() ?? ""
  const showBackLink = mounted && isToolOpen

  const grouped = useMemo(() => groupToolsByCategory(tools, categoryOrder), [tools, categoryOrder])
  const categoryParam = searchParams?.get("category")?.toLowerCase() || ""
  const selectedCategoryFromQuery = categoryOrder.includes(categoryParam) ? categoryParam : null
  const openToolCategory =
    isToolOpen && tools.find((x) => x.alias.toLowerCase() === openToolAlias)
      ? (tools.find((x) => x.alias.toLowerCase() === openToolAlias)!.category_slug ?? DEFAULT_CATEGORY_SLUG).toLowerCase()
      : null
  const selectedCategory = selectedCategoryFromQuery ?? openToolCategory ?? categoryOrder[0] ?? DEFAULT_CATEGORY_SLUG

  const setCategory = (key: string) => {
    router.push(`/store?category=${key}`, { scroll: false })
  }

  return (
    <aside className="w-56 shrink-0 border-r border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900/95 flex flex-col">
      {/* Cấu trúc cố định: back link (hidden khi !showBackLink) → categories → nav. showBackLink = mounted && isToolOpen để tránh lệch server/client. */}
      <div className={`p-2 border-b border-slate-200/80 dark:border-gray-800 ${!showBackLink ? "hidden" : ""}`}>
        <Link
          href="/store"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          {t("tools.store.backToList")}
        </Link>
      </div>
      <div className="px-3 py-3 border-b border-slate-200/80 dark:border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t("tools.store.categories")}
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          categoryOrder.map((key) => {
            const items = grouped[key] ?? []
            const count = items.length
            const isActive = selectedCategory === key
            const Icon = CATEGORY_ICONS[key] ?? Grid3X3
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                  ${isActive
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-medium"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"}
                `}
              >
                <Icon className="w-5 h-5 shrink-0 opacity-80" />
                <span className="flex-1 text-sm truncate">{categoryLabels[key] ?? key}</span>
                {count > 0 && (
                  <span
                    className={`
                      text-xs font-medium tabular-nums shrink-0
                      ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })
        )}
      </nav>
    </aside>
  )
}
