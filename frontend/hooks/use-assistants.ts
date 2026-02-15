"use client"

import { useState, useEffect } from "react"
import type { Assistant, AssistantConfig } from "@/lib/assistants"
import { fetchAssistantConfigs, fetchAssistantByAlias } from "@/lib/api/assistants-api"

/**
 * Hook lấy danh sách trợ lý (config + metadata)
 */
export function useAssistants() {
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchAssistants() {
      try {
        setLoading(true)
        setError(null)
        const configs = await fetchAssistantConfigs()
        const assistantPromises = configs.map(async (config: AssistantConfig) => {
          try {
            const assistant = await fetchAssistantByAlias(config.alias)
            return assistant || null
          } catch {
            return null
          }
        })
        const fetched = (await Promise.all(assistantPromises)).filter((a): a is Assistant => a !== null)
        if (!cancelled) {
          setAssistants(fetched)
          if (fetched.length === 0 && configs.length > 0) setError(new Error("Không thể tải metadata trợ lý"))
          else if (configs.length === 0) setError(new Error("Chưa có trợ lý nào"))
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error("Failed to fetch assistants"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAssistants()
    return () => { cancelled = true }
  }, [])

  return { assistants, loading, error }
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
