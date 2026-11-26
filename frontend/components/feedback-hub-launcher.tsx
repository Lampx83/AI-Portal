"use client"

import { useEffect, useState } from "react"
import { API_CONFIG } from "@/lib/config"

type HubConfig = { enabled: boolean; hubUrl?: string; project?: string }

let cached: Promise<HubConfig> | null = null
/** Cấu hình công khai của Feedback Hub (không chứa khoá). Lỗi mạng ⇒ coi như tắt để rơi về hộp góp ý cũ. */
export function loadFeedbackHubConfig(): Promise<HubConfig> {
  cached ??= fetch(`${API_CONFIG.baseUrl}/api/feedback-hub/config`, { credentials: "include", cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<HubConfig>) : { enabled: false }))
    .catch(() => ({ enabled: false }))
  return cached
}

/** Hook cho header: null = đang tải; enabled=false ⇒ dùng nút góp ý cũ. */
export function useFeedbackHub(): HubConfig | null {
  const [cfg, setCfg] = useState<HubConfig | null>(null)
  useEffect(() => {
    let alive = true
    void loadFeedbackHubConfig().then((c) => alive && setCfg(c))
    return () => {
      alive = false
    }
  }, [])
  return cfg
}

/**
 * Chỗ đặt nút góp ý của Feedback Hub (widget tự vẽ nút vào đây). Nạp widget.js một lần cho cả trang.
 * Chỉ render khi người dùng đã đăng nhập (header chỉ dựng nút này khi có session).
 */
export function FeedbackHubLauncher({ cfg }: { cfg: HubConfig }) {
  useEffect(() => {
    if (!cfg.enabled || !cfg.hubUrl || !cfg.project || document.getElementById("feedbackhub-widget")) return
    const s = document.createElement("script")
    s.id = "feedbackhub-widget"
    s.src = `${cfg.hubUrl}/widget.js`
    s.defer = true
    s.setAttribute("data-project", cfg.project)
    s.setAttribute("data-token-url", `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/feedback-hub/token`)
    s.setAttribute("data-fab", "false")
    document.body.appendChild(s)
  }, [cfg])
  return <span data-feedbackhub-launcher hidden className="inline-flex h-10 w-10 items-center justify-center rounded-full text-inherit hover:bg-white/10" />
}
