"use client"

import { useState, useEffect, useCallback } from "react"
import type { Assistant, AssistantConfig } from "@/lib/assistants"
import { fetchAssistantConfigs, fetchAssistantByAlias } from "@/lib/api/assistants-api"

const DB_CHANGED_EVENT = "portal-database-changed"

/**
 * Hook lấy danh sách trợ lý (config + metadata).
 * Kiểm tra từng assistant một, cái nào xong thì hiển thị ngay nhưng vẫn giữ đúng thứ tự (theo config).
 * Refetch khi tab được focus lại hoặc khi đổi database (event portal-database-changed).
 */
export function useAssistants() {
  const [assistants, setAssistants] = useState<(Assistant | null)[]>([])
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
    async function fetchAssistants() {
      try {
        setLoading(true)
        setError(null)
        const configs = await fetchAssistantConfigs()
        if (cancelled) return
        if (configs.length === 0) {
          setAssistants([])
          setError(new Error("Chưa có trợ lý nào"))
          setLoading(false)
          return
        }
        setAssistants(configs.map(() => null))
        setLoading(false)

        configs.forEach((config: AssistantConfig, index: number) => {
          fetchAssistantByAlias(config.alias)
            .then((assistant) => {
              if (cancelled) return
              setAssistants((prev) => {
                const next = [...prev]
                next[index] = assistant ?? null
                return next
              })
            })
            .catch(() => {
              if (cancelled) return
              setAssistants((prev) => {
                const next = [...prev]
                next[index] = null
                return next
              })
            })
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch assistants"))
          setLoading(false)
        }
      }
    }
    fetchAssistants()
    return () => { cancelled = true }
  }, [refreshKey])

  const list = assistants.filter((a): a is Assistant => a !== null)
  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])
  return { assistants: list, loading, error, refetch }
}

/**
 * Hook lấy một trợ lý theo alias
 * Khi cấu hình Trợ lý chính (Central) được lưu từ Admin, refetch để hiển thị đúng model đã chọn.
 */
export function useAssistant(alias: string | null) {
  const [assistant, setAssistant] = useState<Assistant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!alias) return
    const onCentralConfigSaved = () => {
      if (alias === "central" || alias === "main") setRefreshKey((k) => k + 1)
    }
    window.addEventListener("central-agent-config-saved", onCentralConfigSaved)
    return () => window.removeEventListener("central-agent-config-saved", onCentralConfigSaved)
  }, [alias])

  useEffect(() => {
    if (!alias) return
    const onCentralConfigSaved = () => {
      if (alias === "central" || alias === "main") setRefreshKey((k) => k + 1)
    }
    window.addEventListener("central-agent-config-saved", onCentralConfigSaved)
    return () => window.removeEventListener("central-agent-config-saved", onCentralConfigSaved)
  }, [alias])

  useEffect(() => {
    if (!alias) {
      setAssistant(null)
      setLoading(false)
      return
    }
    let cancelled = false
    const shouldRefetchFromSave =
      (alias === "central" || alias === "main") &&
      typeof window !== "undefined" &&
      (() => {
        try {
          const raw = sessionStorage.getItem("central-agent-config-saved")
          if (!raw) return false
          const t = Number(raw)
          if (Number.isNaN(t) || Date.now() - t > 60000) return false
          sessionStorage.removeItem("central-agent-config-saved")
          return true
        } catch {
          return false
        }
      })()
    async function fetchAssistant() {
      try {
        setLoading(true)
        setError(null)
        const fetched = await fetchAssistantByAlias(alias!)
        if (!cancelled) {
          setAssistant(fetched)
          if (!fetched) setError(new Error(`Trợ lý ${alias} không tồn tại`))
          else if (fetched.health === "unhealthy") setError(new Error(`Trợ lý ${alias} hiện không khả dụng`))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to fetch assistant"))
          setAssistant(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAssistant()
    return () => { cancelled = true }
  }, [alias, refreshKey])

  return { assistant, loading, error }
}
