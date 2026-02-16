"use client"

import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { useActiveProject } from "@/contexts/active-project-context"
import { useWriteEditorState } from "./useWriteEditorState"
import { useWriteEditorEffects } from "./useWriteEditorEffects"
import type { WriteEditorEnv } from "./useWriteEditorEffects"
import { useWriteEditorHandlers } from "./useWriteEditorHandlers"

/**
 * Composer hook: state + effects + handlers for WriteApplicationView.
 * Use this when the view is refactored to consume a single hook.
 * Until then, the view uses state/effects/handlers inline.
 */
export function useWriteEditor() {
  const { data: session } = useSession()
  const { activeProject } = useActiveProject()
  const searchParams = useSearchParams()
  const env: WriteEditorEnv = {
    session,
    activeProject,
    searchParams,
  }
  const bag = useWriteEditorState()
  const handlers = useWriteEditorHandlers(bag, env)
  useWriteEditorEffects(bag, env, handlers)
  return { ...bag, ...handlers }
}
