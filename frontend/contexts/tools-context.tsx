"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import type { Assistant } from "@/lib/assistants"
import { fetchAllTools } from "@/lib/api/tools-api"
import { getStoredPinnedTools, getStoredUnpinnedTools, PINNED_TOOLS_CHANGED_EVENT } from "@/lib/pinned-tools-storage"

const DB_CHANGED_EVENT = "portal-database-changed"

type ToolsContextValue = {
  tools: Assistant[]
  pinnedTools: Assistant[]
  userPinnedAliases: string[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

const ToolsContext = createContext<ToolsContextValue | null>(null)

export function ToolsProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [userPinnedAliases, setUserPinnedAliases] = useState<string[]>(() => getStoredPinnedTools())
  const [userUnpinnedAliases, setUserUnpinnedAliases] = useState<string[]>(() => getStoredUnpinnedTools())

  useEffect(() => {
    const onRefresh = () => setRefreshKey((k) => k + 1)
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      try {
        if (localStorage.getItem("portal-database-changed") != null) {
          localStorage.removeItem("portal-database-changed")
          onRefresh()
        }
      } catch {
        onRefresh()
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onRefresh()
    }
    window.addEventListener(DB_CHANGED_EVENT, onRefresh)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener(DB_CHANGED_EVENT, onRefresh)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  useEffect(() => {
    const onPinnedChange = () => {
      setUserPinnedAliases(getStoredPinnedTools())
      setUserUnpinnedAliases(getStoredUnpinnedTools())
    }
    window.addEventListener(PINNED_TOOLS_CHANGED_EVENT, onPinnedChange)
    return () => window.removeEventListener(PINNED_TOOLS_CHANGED_EVENT, onPinnedChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const list = await fetchAllTools()
        if (!cancelled) {
          setTools(list)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch tools"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const pinnedTools = useMemo(() => {
    const userPinnedSet = new Set(userPinnedAliases.map((a) => a.toLowerCase()))
    const userUnpinnedSet = new Set(userUnpinnedAliases.map((a) => a.toLowerCase()))
    // User đã pin → hiện. User đã unpin → ẩn (kể cả admin pin). Chưa thiết lập → theo admin (t.pinned).
    const list = tools.filter((t) => {
      const a = t.alias.toLowerCase()
      if (userPinnedSet.has(a)) return true
      if (userUnpinnedSet.has(a)) return false
      return !!t.pinned
    })
    const hasUserPreference = userPinnedAliases.length > 0 || userUnpinnedAliases.length > 0
    if (list.length === 0 && !hasUserPreference && tools.length > 0) return tools
    return list
  }, [tools, userPinnedAliases, userUnpinnedAliases])

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  const value = useMemo<ToolsContextValue>(
    () => ({
      tools,
      pinnedTools,
      userPinnedAliases,
      loading,
      error,
      refetch,
    }),
    [tools, pinnedTools, userPinnedAliases, loading, error, refetch]
  )

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>
}

export function useTools(): ToolsContextValue {
  const ctx = useContext(ToolsContext)
  if (!ctx) {
    return {
      tools: [],
      pinnedTools: [],
      userPinnedAliases: getStoredPinnedTools(),
      loading: true,
      error: null,
      refetch: () => {},
    }
  }
  return ctx
}
