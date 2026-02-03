"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Research } from "@/types"

type SetActiveResearch = (research: Research | null) => void

const ActiveResearchContext = createContext<{
  activeResearch: Research | null
  setActiveResearch: SetActiveResearch
} | null>(null)

export function ActiveResearchProvider({
  activeResearch,
  setActiveResearch,
  children,
}: {
  activeResearch: Research | null
  setActiveResearch: SetActiveResearch
  children: ReactNode
}) {
  return (
    <ActiveResearchContext.Provider value={{ activeResearch, setActiveResearch }}>
      {children}
    </ActiveResearchContext.Provider>
  )
}

export function useActiveResearch() {
  const ctx = useContext(ActiveResearchContext)
  if (!ctx) {
    return { activeResearch: null as Research | null, setActiveResearch: (() => {}) as SetActiveResearch }
  }
  return ctx
}
