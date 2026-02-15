"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { Project } from "@/types"

type SetActiveProject = (project: Project | null) => void

const ActiveProjectContext = createContext<{
  activeProject: Project | null
  setActiveProject: SetActiveProject
} | null>(null)

export function ActiveProjectProvider({
  activeProject,
  setActiveProject,
  children,
}: {
  activeProject: Project | null
  setActiveProject: SetActiveProject
  children: ReactNode
}) {
  return (
    <ActiveProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ActiveProjectContext.Provider>
  )
}

export function useActiveProject() {
  const ctx = useContext(ActiveProjectContext)
  if (!ctx) {
    return { activeProject: null as Project | null, setActiveProject: (() => {}) as SetActiveProject }
  }
  return ctx
}
