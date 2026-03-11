"use client"

import { useState, useEffect } from "react"
import {
  getStoredToolsDisplayOrder,
  setStoredToolsDisplayOrder,
  TOOLS_DISPLAY_ORDER_CHANGED_EVENT,
} from "@/lib/tools-display-order-storage"

export function useToolsDisplayOrder(): string[] {
  const [order, setOrder] = useState<string[]>(() => getStoredToolsDisplayOrder())

  useEffect(() => {
    const onChanged = () => setOrder(getStoredToolsDisplayOrder())
    window.addEventListener(TOOLS_DISPLAY_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TOOLS_DISPLAY_ORDER_CHANGED_EVENT, onChanged)
  }, [])

  return order
}

export function setToolsDisplayOrder(aliases: string[]): void {
  setStoredToolsDisplayOrder(aliases)
}
