"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChatInterface } from "@/components/chat-interface"
import { useResearchAssistant } from "@/hooks/use-research-assistants"
import { API_CONFIG } from "@/lib/config"
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage"
import { getOrCreateGuestDeviceId, setGuestAlreadySentForAssistant } from "@/lib/guest-device-id"
import { isValidEmbedIcon, EMBED_COLOR_OPTIONS } from "@/lib/embed-theme"
import type { IconName } from "@/lib/research-assistants"

const backendUrl = API_CONFIG.baseUrl

export default function EmbedAssistantPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Đang tải…</div>}>
      <EmbedAssistantPageImpl />
    </Suspense>
  )
}

function EmbedAssistantPageImpl() {
  const params = useParams()
  const aliasParam = (Array.isArray(params?.alias) ? params?.alias[0] : params?.alias) ?? ""
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sidEnsuredRef = useRef(false)

  const [sessionId, setSessionId] = useState(() => searchParams?.get("sid") ?? "")
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; status?: string }>>([])

  const { assistant, loading: assistantLoading } = useResearchAssistant(aliasParam || null)

  // Màu và icon từ URL (?color=...&icon=...) – dùng khi nhúng để tùy chỉnh giao diện
  const colorParam = searchParams?.get("color") || searchParams?.get("theme") || ""
  const iconParam = searchParams?.get("icon") || ""
  const embedTheme = EMBED_COLOR_OPTIONS.some((c) => c.value === colorParam) ? colorParam : undefined
  const embedIcon: IconName | undefined = isValidEmbedIcon(iconParam) ? iconParam : undefined

  useEffect(() => {
    if (sidEnsuredRef.current) return
    const currentSid = searchParams?.get("sid")
    if (currentSid) {
      setSessionId(currentSid)
      sidEnsuredRef.current = true
      return
    }
    const stored = getStoredSessionId(aliasParam)
    if (stored) {
      const sp = new URLSearchParams(searchParams?.toString() ?? "")
      sp.set("sid", stored)
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
      setSessionId(stored)
      sidEnsuredRef.current = true
      return
    }
    const newSid = crypto.randomUUID()
    const sp = new URLSearchParams(searchParams?.toString() ?? "")
    sp.set("sid", newSid)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    setSessionId(newSid)
    sidEnsuredRef.current = true
  }, [pathname, searchParams, router, aliasParam])

  const sid = searchParams?.get("sid") ?? sessionId

  useEffect(() => {
    if (aliasParam && sid) setStoredSessionId(aliasParam, sid)
  }, [aliasParam, sid])

  const ensureSessionId = () => {
    if (searchParams?.get("sid")) return searchParams.get("sid")
    const newSid = crypto.randomUUID()
    setSessionId(newSid)
    const sp = new URLSearchParams(searchParams?.toString() ?? "")
    sp.set("sid", newSid)
    router.replace(`${pathname}?${sp.toString()}`)
    return newSid
  }

  if (assistantLoading || !assistant) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        {assistantLoading ? "Đang tải trợ lý…" : "Không tìm thấy trợ lý."}
      </div>
    )
  }

  const samplePrompts = (assistant.sample_prompts ?? []).slice(0, 3)
  const defaultMainPrompts = [
    "Bạn có thể giúp tôi tìm tài liệu về chủ đề này không?",
    "Tóm tắt giúp tôi các ý chính của bài nghiên cứu.",
    "Gợi ý cách viết phần phương pháp cho bài báo.",
  ]
  const defaultDataPrompts = [
    "Phân tích dữ liệu này giúp tôi.",
    "Vẽ biểu đồ thể hiện xu hướng.",
    "Tìm các giá trị ngoại lệ trong tập dữ liệu.",
  ]
  const fallback =
    aliasParam === "main" ? defaultMainPrompts : aliasParam === "data" ? defaultDataPrompts : []
  const sampleSuggestions = samplePrompts.length >= 3 ? samplePrompts : [...samplePrompts, ...fallback].slice(0, 3)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ChatInterface
        key={sid || "no-sid"}
        className="flex-1 min-h-0 bg-background"
        assistantName={assistant.name}
        assistantAlias={assistant.alias}
        researchContext={null}
        sessionId={sid || undefined}
        embedLayout
        embedIcon={embedIcon}
        embedTheme={embedTheme}
        sampleSuggestions={sampleSuggestions.length > 0 ? sampleSuggestions : undefined}
        onMessagesChange={() => {}}
        onChatStart={() => {
          ensureSessionId()
        }}
        onFileUploaded={(f) => setUploadedFiles((prev) => [...prev, { ...f, status: "done" }])}
        uploadedFiles={uploadedFiles}
        onClearUploadedFiles={() => setUploadedFiles([])}
        onSendMessage={async (prompt, modelId, signal) => {
          const trimmed = (prompt ?? "").replace(/\s+/g, " ").trim()
          const sessionTitle = trimmed ? trimmed.slice(0, 60) : "File đính kèm"
          const currentSid = ensureSessionId()
          const uploadedDocs = uploadedFiles.map((f) => ({ url: f.url, name: f.name }))
          setUploadedFiles([])

          const requestBody = {
            assistant_base_url: assistant.baseUrl,
            assistant_alias: assistant.alias,
            session_title: sessionTitle,
            user_id: null,
            guest_device_id: getOrCreateGuestDeviceId(),
            model_id: modelId,
            prompt,
            user: "embed-user",
            source: "embed",
            context: {
              language: "vi",
              extra_data: { document: uploadedDocs },
            },
          }

          const res = await fetch(`${backendUrl}/api/chat/sessions/${currentSid}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal,
          })

          if (!res.ok) {
            const errorText = await res.text().catch(() => "")
            let errorMessage = `HTTP ${res.status}: ${res.statusText || "Unknown error"}`
            try {
              const errorJson = JSON.parse(errorText)
              errorMessage = errorJson?.message || errorJson?.error || errorMessage
            } catch {
              if (errorText) errorMessage = errorText
            }
            throw new Error(errorMessage)
          }

          const json = await res.json().catch(() => ({}))
          if (json?.status === "success") {
            setGuestAlreadySentForAssistant(assistant.alias)
            const content = json.content_markdown || ""
            const agents = json?.meta?.agents
            if (agents?.length) return { content, meta: { agents } }
            return content
          }
          throw new Error(json?.error || "Send failed")
        }}
        models={(assistant.supported_models || []).map((m: { model_id: string; name?: string }) => ({
          model_id: m.model_id,
          name: m.name ?? m.model_id,
        }))}
      />
    </div>
  )
}
