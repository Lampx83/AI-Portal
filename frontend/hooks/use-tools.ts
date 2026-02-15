"use client"

import { useState, useEffect } from "react"
import type { Assistant } from "@/lib/assistants"
import { fetchToolConfigs, fetchToolByAlias } from "@/lib/api/tools-api"
import type { ToolConfigResponse } from "@/lib/api/tools-api"

/**
 * Hook lấy danh sách công cụ (write, data) — tách khỏi trợ lý
 */
export function useTools() {
  const [tools, setTools] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

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
  }, [])

  return { tools, loading, error }
}
