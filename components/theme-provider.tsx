"use client"

import type * as React from "react"
import { createContext, useContext, useEffect, useMemo, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "neu-ui-theme",
}: ThemeProviderProps) {
  // Bước 1: state khởi tạo = defaultTheme (an toàn SSR)
  const [theme, _setTheme] = useState<Theme>(defaultTheme)

  // Bước 2: khi client mount, đọc localStorage nếu có
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null
      if (stored) _setTheme(stored)
    } catch { }
  }, [storageKey])

  // Bước 3: apply theme vào <html> + lắng nghe thay đổi system (prefers-color-scheme)
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia("(prefers-color-scheme: dark)")

    const apply = (t: Theme) => {
      root.classList.remove("light", "dark")
      if (t === "system") {
        root.classList.add(mq.matches ? "dark" : "light")
      } else {
        root.classList.add(t)
      }
    }

    apply(theme)

    // Khi theme = system, theo dõi thay đổi của system để cập nhật UI ngay
    const onChange = () => theme === "system" && apply("system")
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [theme])

  // Bước 4: setter có nhiệm vụ lưu localStorage
  const setTheme = (t: Theme) => {
    _setTheme(t)
    try {
      localStorage.setItem(storageKey, t)
    } catch { }
  }

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const ctx = useContext(ThemeProviderContext)
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider")
  return ctx
}
