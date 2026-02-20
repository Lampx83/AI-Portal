"use client"

import { useState, useEffect } from "react"
import type { Assistant, AssistantConfig } from "@/lib/assistants"
import { fetchAssistantConfigs, fetchAssistantByAlias } from "@/lib/api/assistants-api"

/**
 * Hook lấy danh sách trợ lý (config + metadata).
 * Kiểm tra từng assistant một, cái nào xong thì hiển thị ngay nhưng vẫn giữ đúng thứ tự (theo config).
 */
export function useAssistants() {
  const [assistants, setAssistants] = useState<(Assistant | null)[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

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
  }, [])

  const list = assistants.filter((a): a is Assistant => a !== null)
  return { assistants: list, loading, error }
}

/**
 * Hook lấy một trợ lý theo alias
 */
export function useAssistant(alias: string | null) {
  const [assistant, setAssistant] = useState<Assistant | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!alias) {
      setAssistant(null)
      setLoading(false)
      return
    }
    let cancelled = false
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
  }, [alias])

  return { assistant, loading, error }
}
