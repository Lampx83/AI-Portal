"use client"

import { useState, useEffect } from "react"
import {
  getStoredPinnedAssistants,
  getStoredUnpinnedAssistants,
  PINNED_ASSISTANTS_CHANGED_EVENT,
} from "@/lib/pinned-assistants-storage"

export function usePinnedAssistants(): { userPinnedAliases: string[]; userUnpinnedAliases: string[] } {
  const [userPinnedAliases, setUserPinnedAliases] = useState<string[]>(() => getStoredPinnedAssistants())
  const [userUnpinnedAliases, setUserUnpinnedAliases] = useState<string[]>(() => getStoredUnpinnedAssistants())

  useEffect(() => {
    const onChanged = () => {
      setUserPinnedAliases(getStoredPinnedAssistants())
      setUserUnpinnedAliases(getStoredUnpinnedAssistants())
    }
    window.addEventListener(PINNED_ASSISTANTS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(PINNED_ASSISTANTS_CHANGED_EVENT, onChanged)
  }, [])

  return { userPinnedAliases, userUnpinnedAliases }
}
