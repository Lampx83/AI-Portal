"use client"

import { useState, useEffect } from "react"
import type { ResearchAssistant, ResearchAssistantConfig } from "@/lib/research-assistants"
import {
  fetchResearchAssistantConfigs,
  fetchResearchAssistantByAlias,
} from "@/lib/api/research-assistants"

/**
 * Hook để fetch danh sách cấu hình các trợ lý (không có metadata)
 * Sau đó fetch metadata cho từng trợ lý khi cần
 */
export function useResearchAssistants() {
  const [assistants, setAssistants] = useState<ResearchAssistant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchAssistants() {
      try {
        setLoading(true)
        setError(null)

        // Bước 1: Fetch danh sách config từ backend (nhanh)
        const configs = await fetchResearchAssistantConfigs()

        // Bước 2: Fetch metadata cho từng trợ lý song song
        const assistantPromises = configs.map(async (config: ResearchAssistantConfig) => {
          try {
            const assistant = await fetchResearchAssistantByAlias(config.alias)
            return assistant || null
          } catch (err) {
            console.warn(`Failed to fetch metadata for ${config.alias}:`, err)
            return null
          }
        })

        const fetchedAssistants = (await Promise.all(assistantPromises)).filter(
          (a): a is ResearchAssistant => a !== null
        )

        if (!cancelled) {
          setAssistants(fetchedAssistants)
          // Chỉ set error nếu không có assistant nào
          if (fetchedAssistants.length === 0 && configs.length > 0) {
            setError(new Error("Không thể tải được metadata của trợ lý nào"))
          } else if (configs.length === 0) {
            setError(new Error("Không có trợ lý nào được cấu hình"))
          }
        }
      } catch (err) {
        // Catch mọi lỗi không mong đợi
        if (!cancelled) {
          console.error("Unexpected error in fetchAssistants:", err)
          setError(err instanceof Error ? err : new Error("Failed to fetch assistants"))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAssistants()

    return () => {
      cancelled = true
    }
  }, [])

  return { assistants, loading, error }
}

/**
 * Hook để fetch một trợ lý theo alias với metadata từ API
 */
export function useResearchAssistant(alias: string | null) {
  const [assistant, setAssistant] = useState<ResearchAssistant | null>(null)
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

        const fetchedAssistant = await fetchResearchAssistantByAlias(alias!)

        if (!cancelled) {
          if (!fetchedAssistant) {
            setAssistant(null)
            setError(new Error(`Trợ lý ${alias} không tồn tại`))
          } else {
            setAssistant(fetchedAssistant)
            // Nếu trợ lý unhealthy, set error để thông báo
            if (fetchedAssistant.health === "unhealthy") {
              setError(new Error(`Trợ lý ${alias} hiện không khả dụng`))
            }
          }
        }
      } catch (err) {
        // Catch mọi lỗi và không throw
        if (!cancelled) {
          console.error(`Error fetching assistant ${alias}:`, err)
          setError(err instanceof Error ? err : new Error("Failed to fetch assistant"))
          setAssistant(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchAssistant()

    return () => {
      cancelled = true
    }
  }, [alias])

  return { assistant, loading, error }
}
