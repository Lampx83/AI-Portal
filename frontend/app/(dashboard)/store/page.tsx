"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTools } from "@/hooks/use-tools"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Sparkles, Search, Pin, PinOff } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Assistant } from "@/lib/assistants"
import { getToolIcon } from "@/lib/tool-icons"
import { ToolsSidebar } from "../tools/tools-sidebar"
import { addStoredPinnedTool, removeStoredPinnedTool, MAX_PINNED_TOOLS } from "@/lib/pinned-tools-storage"
import { fetchCategories, type ToolCategory } from "@/lib/api/tools-api"

const DEFAULT_CATEGORY_SLUG = "general"

type GroupedTools = Record<string, Assistant[]>

function groupToolsByCategory(tools: Assistant[], categoryOrder: string[]): GroupedTools {
  const groups: GroupedTools = {}
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

function getCategoryLabel(slug: string, categories: ToolCategory[]): string {
  const cat = categories.find((c) => c.slug.toLowerCase() === slug.toLowerCase())
  return cat?.name ?? slug
}

/** Map category slug to display label (from API or fallback). */
function buildCategoryLabels(categories: ToolCategory[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of categories) {
    out[c.slug.toLowerCase()] = c.name
  }
  out[DEFAULT_CATEGORY_SLUG] = out[DEFAULT_CATEGORY_SLUG] ?? "General"
  return out
}

/** Spotlight card — app nổi bật lớn kiểu App Store (một app đầu category). */
function SpotlightCard({
  tool,
  onView,
  onOpen,
  t,
  getToolIcon,
  categoryLabel,
}: {
  tool: Assistant
  onView: () => void
  onOpen: () => void
  t: (key: string) => string
  getToolIcon: (alias: string, fallback: LucideIcon) => LucideIcon
  categoryLabel: string
}) {
  const isUnhealthy = tool.health === "unhealthy"
  const displayName = tool.name || tool.alias || "Tool"
  const ToolIcon = getToolIcon(tool.alias, tool.Icon)
  return (
    <div className="group flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-5 sm:p-6 rounded-3xl bg-white dark:bg-gray-900 border-2 border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-md hover:shadow-xl hover:border-emerald-300/60 dark:hover:border-emerald-600/40 transition-all duration-200 hover:-translate-y-0.5">
      <button
        type="button"
        onClick={onView}
        disabled={isUnhealthy}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1 min-w-0 text-left disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-3xl"
      >
        <div className={`w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 ${tool.bgColor}`}>
          <ToolIcon className={`h-12 w-12 sm:h-14 sm:w-14 ${tool.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {categoryLabel}
          </span>
          <h3 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {displayName}
          </h3>
          {tool.description && (
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {tool.description}
            </p>
          )}
        </div>
      </button>
      <div className="shrink-0 self-center sm:self-auto">
        <Button
          size="lg"
          className="rounded-full font-semibold gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-gray-200"
          disabled={isUnhealthy}
          onClick={onOpen}
        >
          {t("tools.store.openApp")}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
}

/** Loading skeletons — bố cục giống trang thật (breadcrumb, search, pills, spotlight, featured, grid). */
function ToolsStoreSkeletons() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-4 w-3 rounded" />
        <Skeleton className="h-4 w-20 rounded" />
      </div>
      {/* Search + Pills */}
      <div className="space-y-4">
        <Skeleton className="h-12 w-full max-w-md rounded-2xl" />
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>
      {/* Section title + Quick access + Spotlight */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-28 rounded" />
        <Skeleton className="h-5 w-20 rounded" />
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-20 w-16 shrink-0 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
      {/* Featured strip */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-24 rounded" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-40 shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
      {/* All apps grid */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-32 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, j) => (
            <Skeleton key={j} className="h-52 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Featured app card — horizontal strip, compact. Optionally larger when isFirst. */
function FeaturedAppCard({
  tool,
  onView,
  onOpen,
  t,
  getToolIcon,
  isFirst = false,
}: {
  tool: Assistant
  onView: () => void
  onOpen: () => void
  t: (key: string) => string
  getToolIcon: (alias: string, fallback: LucideIcon) => LucideIcon
  isFirst?: boolean
}) {
  const isUnhealthy = tool.health === "unhealthy"
  const displayName = tool.name || tool.alias || "Tool"
  const ToolIcon = getToolIcon(tool.alias, tool.Icon)
  return (
    <div className={`group shrink-0 flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-gray-700 transition-all duration-200 hover:-translate-y-0.5 ${isFirst ? "w-44 border-2 border-emerald-200/60 dark:border-emerald-800/40" : "w-40"}`}>
      <button
        type="button"
        onClick={onView}
        disabled={isUnhealthy}
        className="flex flex-col flex-1 min-h-0 text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-2xl"
      >
        <div className={`p-4 flex items-center justify-center aspect-square ${tool.bgColor}`}>
          <ToolIcon className={`${isFirst ? "h-14 w-14" : "h-12 w-12"} ${tool.iconColor} transition-transform group-hover:scale-110`} />
        </div>
        <div className="p-3 flex flex-col flex-1 min-h-0">
          <h3 className={`font-semibold text-slate-900 dark:text-white line-clamp-1 ${isFirst ? "text-base" : "text-sm"}`}>{displayName}</h3>
          {tool.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{tool.description}</p>
          )}
        </div>
      </button>
      <div className="px-3 pb-3">
        <Button
          size="sm"
          className="w-full rounded-full font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-gray-200"
          disabled={isUnhealthy}
          onClick={onOpen}
        >
          {t("tools.store.open")}
        </Button>
      </div>
    </div>
  )
}

/** App card — grid item, App Store style: description nổi bật, nút Open gọn. */
function AppCard({
  tool,
  onView,
  onOpen,
  t,
  getToolIcon,
  isPinned,
  isUserPinned,
  canPin = true,
  onPin,
  onUnpin,
}: {
  tool: Assistant
  onView: () => void
  onOpen: () => void
  t: (key: string) => string
  getToolIcon: (alias: string, fallback: LucideIcon) => LucideIcon
  isPinned?: boolean
  isUserPinned?: boolean
  canPin?: boolean
  onPin?: () => void
  onUnpin?: () => void
}) {
  const isUnhealthy = tool.health === "unhealthy"
  const displayName = tool.name || tool.alias || "Tool"
  const ToolIcon = getToolIcon(tool.alias, tool.Icon)
  const hasDescription = !!tool.description?.trim()
  return (
    <article
      className="group flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-slate-200/80 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-gray-700 transition-all duration-200 hover:-translate-y-1"
    >
      <button
        type="button"
        onClick={onView}
        disabled={isUnhealthy}
        className="flex flex-col flex-1 min-h-0 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-2xl"
      >
        <div className="flex items-start gap-4 p-5">
          <div
            className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${tool.bgColor}`}
          >
            <ToolIcon className={`h-7 w-7 ${tool.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-white text-base leading-snug">{displayName}</h3>
            {hasDescription ? (
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 line-clamp-3">{tool.description}</p>
            ) : (
              <p className="mt-1.5 text-sm text-slate-400 dark:text-slate-500 italic line-clamp-2">
                {t("tools.store.noDescription")}
              </p>
            )}
          </div>
        </div>
      </button>
      <div className="px-5 pb-5 pt-0 flex flex-wrap items-center gap-2">
        {(onPin || onUnpin) && (
          <>
            {isUserPinned && onUnpin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-gray-600"
                onClick={onUnpin}
              >
                <PinOff className="h-4 w-4" />
                {t("tools.store.unpin")}
              </Button>
            ) : !isPinned && onPin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 disabled:opacity-60"
                onClick={onPin}
                disabled={!canPin}
                title={!canPin ? t("tools.store.pinLimitReached") : undefined}
              >
                <Pin className="h-4 w-4" />
                {t("tools.store.pin")}
              </Button>
            ) : null}
          </>
        )}
        <Button
          size="sm"
          className="rounded-full font-semibold gap-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-gray-200 ml-auto"
          disabled={isUnhealthy}
          onClick={() => {
            if (!isUnhealthy) onOpen()
          }}
          aria-label={t("tools.store.openApp")}
        >
          {t("tools.store.open")}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </article>
  )
}

/** Dialog chi tiết app kiểu App Store: icon lớn, mô tả, metadata, nút Mở. */
function AppDetailDialog({
  tool,
  categoryLabel,
  onOpen,
  onClose,
  t,
}: {
  tool: Assistant
  categoryLabel: string
  onOpen: () => void
  onClose: () => void
  t: (key: string) => string
}) {
  const DetailIcon = getToolIcon(tool.alias, tool.Icon)
  const displayName = tool.name || tool.alias || "Tool"
  const isUnhealthy = tool.health === "unhealthy"

  return (
    <>
      {/* Header: icon lớn + tên + category */}
      <div className="p-6 pb-4 pr-12">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left gap-4">
          <div
            className={`w-20 h-20 shrink-0 rounded-3xl flex items-center justify-center shadow-lg ${tool.bgColor}`}
          >
            <DetailIcon className={`h-10 w-10 ${tool.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 mb-2">
              {categoryLabel}
            </span>
            <DialogTitle className="text-xl sm:text-2xl font-bold break-words pr-8">
              {displayName}
            </DialogTitle>
            {(tool.version ?? tool.developer) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                {tool.version && <span>{t("tools.store.version")}: {tool.version}</span>}
                {tool.developer && <span>{t("tools.store.developer")}: {tool.developer}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mô tả */}
      {tool.description && (
        <div className="px-6 pb-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t("tools.store.aboutApp")}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words leading-relaxed">
            {tool.description}
          </p>
        </div>
      )}

      {/* Tính năng (capabilities) */}
      {tool.capabilities && tool.capabilities.length > 0 && (
        <div className="px-6 pb-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            {t("tools.store.capabilities")}
          </h4>
          <ul className="space-y-1.5">
            {tool.capabilities.map((cap, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400"
              >
                <span className="text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" aria-hidden>•</span>
                <span className="break-words">{cap}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer: Đóng + Mở ứng dụng */}
      <DialogFooter className="p-6 pt-4 border-t border-slate-200 dark:border-gray-800 gap-3 flex-row-reverse sm:flex-row-reverse">
        <Button
          type="button"
          disabled={isUnhealthy}
          onClick={onOpen}
          className="gap-2 rounded-full font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-gray-200"
        >
          {t("tools.store.openApp")}
          <ArrowRight className="w-4 h-4" />
        </Button>
        <Button type="button" variant="outline" onClick={onClose} className="rounded-full">
          {t("common.cancel")}
        </Button>
      </DialogFooter>
    </>
  )
}

export default function ToolsStorePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { toast } = useToast()
  const { tools, pinnedTools, userPinnedAliases, loading, error, refetch } = useTools()
  const [categories, setCategories] = useState<ToolCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    let cancelled = false
    fetchCategories()
      .then((list) => {
        if (!cancelled) setCategories(list)
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const categoryOrder = useMemo(
    () => (categories.length > 0 ? categories.map((c) => c.slug.toLowerCase()) : [DEFAULT_CATEGORY_SLUG]),
    [categories]
  )
  const categoryLabels = useMemo(() => buildCategoryLabels(categories), [categories])

  const pinnedSet = useMemo(() => new Set(pinnedTools.map((p) => p.alias.toLowerCase())), [pinnedTools])
  const userPinnedSet = useMemo(() => new Set(userPinnedAliases.map((a) => a.toLowerCase())), [userPinnedAliases])
  const canPinMore = userPinnedAliases.length < MAX_PINNED_TOOLS

  const categoryParam = searchParams?.get("category")?.toLowerCase() || ""
  const selectedCategory =
    categoryOrder.includes(categoryParam) ? categoryParam : (categoryOrder[0] ?? DEFAULT_CATEGORY_SLUG)

  const grouped = useMemo(() => groupToolsByCategory(tools, categoryOrder), [tools, categoryOrder])

  const toolsToShow = grouped[selectedCategory] ?? []
  const hasAnyTools = tools.length > 0
  const [selectedTool, setSelectedTool] = useState<Assistant | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const activeCategoryPillRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeCategoryPillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [selectedCategory])

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return toolsToShow
    return toolsToShow.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.alias || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    )
  }, [toolsToShow, searchQuery])

  /** Apps từ category khác — cho section "You might also like" (chỉ khi không search). */
  const suggestedTools = useMemo(() => {
    if (searchQuery.trim()) return []
    const others = categoryOrder.filter((c) => c !== selectedCategory)
    const list: Assistant[] = []
    for (const cat of others) {
      const items = grouped[cat] ?? []
      list.push(...items.slice(0, 2))
    }
    return list.slice(0, 6)
  }, [grouped, selectedCategory, searchQuery, categoryOrder])

  const handleOpenTool = (alias: string) => {
    setSelectedTool(null)
    router.push(`/tools/${alias}`)
  }

  const handleOpenDetail = (tool: Assistant) => {
    if (tool.health === "unhealthy") return
    setSelectedTool(tool)
  }

  const handlePin = (alias: string) => {
    if (!addStoredPinnedTool(alias)) {
      toast({ title: t("tools.store.pinLimitReached"), variant: "destructive" })
    }
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <ToolsSidebar />
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
            <p>{t("tools.store.errorLoad")}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <ToolsSidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <main className="flex-1 min-w-0 overflow-auto" role="main" aria-label={t("tools.store.title")}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Hero — App Store style với gradient nhẹ */}
            <header className="mb-8 -mx-4 sm:-mx-6 px-4 sm:px-6 py-6 sm:py-8 rounded-2xl bg-gradient-to-br from-slate-100/90 via-white/80 to-slate-50/90 dark:from-gray-900/90 dark:via-gray-900/70 dark:to-slate-900/80 border border-slate-200/50 dark:border-gray-800/50">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                {t("tools.store.discover")}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {t("tools.store.title")}
              </h1>
              <p className="mt-1.5 text-lg text-slate-600 dark:text-slate-400">
                {t("tools.store.subtitle")}
              </p>
              {hasAnyTools && (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
                  {tools.length} {t("tools.store.appsAvailable")}
                </p>
              )}
            </header>

            {/* Ứng dụng đã ghim — luôn trên cùng */}
            {!loading && hasAnyTools && pinnedTools.length > 0 && (
              <section className="mb-8" aria-labelledby="pinned-apps-heading">
                <h2 id="pinned-apps-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                  {t("tools.store.pinnedApps")}
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                  {pinnedTools.map((tool) => {
                    const isUnhealthy = tool.health === "unhealthy"
                    const name = tool.name || tool.alias || "Tool"
                    const Icon = getToolIcon(tool.alias, tool.Icon)
                    return (
                      <button
                        key={tool.alias}
                        type="button"
                        disabled={isUnhealthy}
                        onClick={() => !isUnhealthy && handleOpenTool(tool.alias)}
                        title={name}
                        aria-label={name}
                        className={`shrink-0 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-200/80 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm transition-all hover:shadow-md hover:border-emerald-300/60 dark:hover:border-emerald-600/40 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isUnhealthy ? "" : "hover:bg-slate-50 dark:hover:bg-gray-800"}`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${tool.bgColor}`}>
                          <Icon className={`h-7 w-7 ${tool.iconColor}`} />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[5rem] text-center">{name}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {loading ? (
              <ToolsStoreSkeletons />
            ) : !hasAnyTools ? (
              <div className="flex flex-col items-center justify-center py-24 text-center rounded-3xl bg-white/80 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-800">
                <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-5">
                  <Sparkles className="w-10 h-10 text-slate-400" />
                </div>
                <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">{t("tools.store.noTools")}</p>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-2 max-w-sm">{t("tools.store.noToolsHint")}</p>
              </div>
            ) : (
              <>
                {/* Breadcrumb: Discover > Category */}
                <nav aria-label="Breadcrumb" className="mb-4">
                  <ol className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <li>{t("tools.store.discover")}</li>
                    <li aria-hidden className="text-slate-400 dark:text-slate-500">/</li>
                    <li className="font-medium text-slate-700 dark:text-slate-300">
                      {categoryLabels[selectedCategory] ?? selectedCategory}
                    </li>
                  </ol>
                </nav>
                {/* Search + Category pills */}
                <div className="space-y-4 mb-8">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" aria-hidden />
                    <Input
                      type="search"
                      placeholder={t("tools.store.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      aria-label={t("tools.store.searchPlaceholder")}
                      className="pl-12 h-12 rounded-2xl border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm text-base"
                    />
                  </div>
                  {/* Category pills — quick switch giống App Store */}
                  <div
                    role="tablist"
                    aria-label={t("tools.store.categories")}
                    className="flex gap-2 overflow-x-auto pb-1 -mx-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600"
                  >
                    {categoryOrder.map((key) => {
                      const count = (grouped[key] ?? []).length
                      const isActive = selectedCategory === key
                      return (
                        <button
                          key={key}
                          ref={isActive ? activeCategoryPillRef : null}
                          role="tab"
                          aria-selected={isActive}
                          aria-label={`${categoryLabels[key] ?? key}${count > 0 ? `, ${count} ${t("tools.store.appsInCategory")}` : ""}`}
                          type="button"
                          onClick={() => router.push(`/store?category=${key}`, { scroll: false })}
                          className={`
                            shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
                            ${isActive
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                              : "bg-white dark:bg-gray-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-700 border border-slate-200/80 dark:border-gray-700"}
                          `}
                        >
                          {categoryLabels[key] ?? key}
                          {count > 0 && (
                            <span className={isActive ? "opacity-80" : "opacity-60"}> · {count}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {filteredTools.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center rounded-3xl bg-white/80 dark:bg-gray-900/80 border border-slate-200/80 dark:border-gray-800">
                    <p className="text-slate-600 dark:text-slate-400 font-medium">{t("tools.store.noSearchResults")}</p>
                    {searchQuery.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 rounded-full"
                        onClick={() => setSearchQuery("")}
                      >
                        {t("tools.store.clearSearch")}
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Section title + count */}
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
                      {categoryLabels[selectedCategory] ?? selectedCategory}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-500 mb-5">
                      {filteredTools.length} {t("tools.store.appsInCategory")}
                    </p>

                    {/* Quick access — mở nhanh bằng icon (tối đa 8 app) */}
                    {filteredTools.length > 0 && (
                      <section className="mb-6" aria-labelledby="quick-access-heading">
                        <h3 id="quick-access-heading" className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                          {t("tools.store.quickAccess")}
                        </h3>
                        <div className="flex gap-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                          {filteredTools.slice(0, 8).map((tool) => {
                            const isUnhealthy = tool.health === "unhealthy"
                            const name = tool.name || tool.alias || "Tool"
                            const Icon = getToolIcon(tool.alias, tool.Icon)
                            return (
                              <button
                                key={tool.alias}
                                type="button"
                                disabled={isUnhealthy}
                                onClick={() => !isUnhealthy && handleOpenTool(tool.alias)}
                                title={name}
                                aria-label={name}
                                className={`shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isUnhealthy ? "" : "hover:bg-slate-100 dark:hover:bg-gray-800"}`}
                              >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${tool.bgColor}`}>
                                  <Icon className={`h-7 w-7 ${tool.iconColor}`} />
                                </div>
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[4.5rem]">{name}</span>
                              </button>
                            )
                          })}
                        </div>
                      </section>
                    )}

                    {/* Spotlight — app nổi bật lớn (app đầu tiên) */}
                    {filteredTools.length > 0 && (
                      <section className="mb-8">
                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                          {t("tools.store.spotlight")}
                        </h3>
                        <SpotlightCard
                          tool={filteredTools[0]}
                          onView={() => handleOpenDetail(filteredTools[0])}
                          onOpen={() => handleOpenTool(filteredTools[0].alias)}
                          t={t}
                          getToolIcon={getToolIcon}
                          categoryLabel={categoryLabels[selectedCategory] ?? selectedCategory}
                        />
                      </section>
                    )}

                    {/* Featured strip — horizontal scroll (first 4) */}
                    {filteredTools.length > 0 && (
                      <section className="mb-10">
                        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                          {t("tools.store.featuredInCategory")}
                        </h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                          {filteredTools.slice(0, 4).map((tool, idx) => (
                            <FeaturedAppCard
                              key={tool.alias}
                              tool={tool}
                              isFirst={idx === 0}
                              onView={() => handleOpenDetail(tool)}
                              onOpen={() => handleOpenTool(tool.alias)}
                              t={t}
                              getToolIcon={getToolIcon}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {/* All apps grid — phân cách rõ với Featured */}
                    <section className="pt-2">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                        {t("tools.store.allInCategory")}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTools.map((tool) => (
                          <AppCard
                            key={tool.alias}
                            tool={tool}
                            onView={() => handleOpenDetail(tool)}
                            onOpen={() => handleOpenTool(tool.alias)}
                            t={t}
                            getToolIcon={getToolIcon}
                            isPinned={pinnedSet.has(tool.alias.toLowerCase())}
                            isUserPinned={userPinnedSet.has(tool.alias.toLowerCase())}
                            canPin={canPinMore}
                            onPin={() => handlePin(tool.alias)}
                            onUnpin={() => removeStoredPinnedTool(tool.alias)}
                          />
                        ))}
                      </div>
                    </section>

                    {/* You might also like — gợi ý từ category khác */}
                    {suggestedTools.length > 0 && (
                      <section
                        className="mt-12 pt-8 border-t border-slate-200/80 dark:border-gray-800"
                        aria-labelledby="you-might-also-like-heading"
                      >
                        <h3 id="you-might-also-like-heading" className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wide">
                          {t("tools.store.youMightAlsoLike")}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {suggestedTools.map((tool) => (
                            <AppCard
                              key={tool.alias}
                              tool={tool}
                              onView={() => handleOpenDetail(tool)}
                              onOpen={() => handleOpenTool(tool.alias)}
                              t={t}
                              getToolIcon={getToolIcon}
                              isPinned={pinnedSet.has(tool.alias.toLowerCase())}
                              isUserPinned={userPinnedSet.has(tool.alias.toLowerCase())}
                              canPin={canPinMore}
                              onPin={() => handlePin(tool.alias)}
                              onUnpin={() => removeStoredPinnedTool(tool.alias)}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </>
            )}
            {/* Footer note — kiểu App Store */}
            {!loading && hasAnyTools && (
              <p className="mt-12 pt-8 border-t border-slate-200/80 dark:border-gray-800 text-center text-xs text-slate-400 dark:text-slate-500">
                {t("tools.store.footerNote")}
              </p>
            )}
          </div>
        </main>

        {/* Dialog chi tiết app — App Store style */}
        <Dialog open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
          <DialogContent className="max-w-md sm:max-w-lg max-h-[90dvh] overflow-y-auto p-0 gap-0">
            {selectedTool && (
              <AppDetailDialog
                tool={selectedTool}
                categoryLabel={getCategoryLabel(selectedTool.category_slug ?? DEFAULT_CATEGORY_SLUG, categories)}
                onOpen={() => handleOpenTool(selectedTool.alias)}
                onClose={() => setSelectedTool(null)}
                t={t}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
