// lib/assistants-store.ts
import { create } from "zustand"
import type { ResearchAssistant } from "@/components/sidebar" // hoặc import từ file bạn định nghĩa

interface AssistantsState {
    assistants: ResearchAssistant[]
    setAssistants: (items: ResearchAssistant[]) => void
    getByAlias: (alias: string) => ResearchAssistant | undefined
}

export const useAssistantsStore = create<AssistantsState>((set, get) => ({
    assistants: [],
    setAssistants: (items) => set({ assistants: items }),
    getByAlias: (alias) => get().assistants.find((a) => a.alias === alias),
}))
