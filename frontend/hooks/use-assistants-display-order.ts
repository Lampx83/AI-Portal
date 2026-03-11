"use client"

import { useState, useEffect } from "react"
import {
  getStoredAssistantsDisplayOrder,
  setStoredAssistantsDisplayOrder,
  ASSISTANTS_DISPLAY_ORDER_CHANGED_EVENT,
} from "@/lib/assistants-display-order-storage"

export function useAssistantsDisplayOrder(): string[] {
  const [order, setOrder] = useState<string[]>(() => getStoredAssistantsDisplayOrder())

  useEffect(() => {
    const onChanged = () => setOrder(getStoredAssistantsDisplayOrder())
    window.addEventListener(ASSISTANTS_DISPLAY_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(ASSISTANTS_DISPLAY_ORDER_CHANGED_EVENT, onChanged)
  }, [])

  return order
}

export function setAssistantsDisplayOrder(aliases: string[]): void {
  setStoredAssistantsDisplayOrder(aliases)
}
