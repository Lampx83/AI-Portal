"use client"

import { useState, useEffect, useCallback } from "react"
import type { Assistant } from "@/lib/assistants"
import { fetchToolConfigs, fetchToolByAlias } from "@/lib/api/tools-api"
import type { ToolConfigResponse } from "@/lib/api/tools-api"

const DB_CHANGED_EVENT = "portal-database-changed"

/**
 * Hook lấy danh sách công cụ (data) — tách khỏi trợ lý.
 * Refetch khi tab được focus lại hoặc khi đổi database (event portal-database-changed).
 */
export function useTools() {
  const [tools, setTools] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
    let cancelled = false
    async function fetchTools() {
      try {
        setLoading(true)
        setError(null)
        const configs = await fetchToolConfigs()
        const promises = configs.map(async (config: ToolConfigResponse) => {
          try {
            const tool = await fetchToolByAlias(config.alias)
            return tool ?? null
          } catch {
            return null
          }
        })
        const fetched = (await Promise.all(promises)).filter((t): t is Assistant => t !== null)
        if (!cancelled) {
          setTools(fetched)
          if (fetched.length === 0 && configs.length > 0) setError(new Error("Không thể tải metadata công cụ"))
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error("Failed to fetch tools"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTools()
    return () => { cancelled = true }
  }, [refreshKey])

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])
  return { tools, loading, error, refetch }
}
