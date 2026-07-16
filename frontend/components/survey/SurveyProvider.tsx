"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getActiveSurvey, getSurveyBySlug, logSurveyImpression, type ActiveSurvey } from "@/lib/api/surveys"
import {
  bumpVisitCount,
  getSurveyState,
  getVisitCount,
  markShown,
} from "@/lib/survey-storage"
import { SurveyPopup } from "./SurveyPopup"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_REASK_DAYS = 15

/** Số ngày hỏi lại: mặc định 15; 0/âm = không hỏi lại. */
function resolveReaskDays(dc: ActiveSurvey["display_config"]): number {
  const v = Number(dc?.reask_days)
  if (!Number.isFinite(v)) return DEFAULT_REASK_DAYS
  return Math.max(0, Math.floor(v))
}

/**
 * Nếu người dùng đã trả lời (client có completedAt):
 * - reask_days <= 0 → không hiện lại nữa (skip).
 * - còn trong cửa sổ reask_days → skip (chặn hiện lại ngay trong phiên/chưa tới hạn).
 * - đã qua cửa sổ → không skip (cho hỏi lại; markCompleted đã xoá trạng thái nag cũ).
 * Trả về null nếu chưa trả lời (để nhường cho logic frequency/dismiss xử lý).
 */
function shouldSkipByReask(surveyId: string, dc: ActiveSurvey["display_config"]): boolean | null {
  const st = getSurveyState(surveyId)
  if (!st.completedAt) return null
  const reaskDays = resolveReaskDays(dc)
  if (reaskDays <= 0) return true
  return Date.now() - st.completedAt < reaskDays * ONE_DAY_MS
}

function pathMatches(patterns: string[] | undefined, pathname: string): boolean {
  if (!patterns || patterns.length === 0) return true
  return patterns.some((p) => {
    const t = p.trim()
    if (!t) return false
    // Hỗ trợ wildcard cuối: /chat*
    if (t.endsWith("*")) return pathname.startsWith(t.slice(0, -1))
    return pathname === t || pathname.startsWith(t.replace(/\/$/, "") + "/")
  })
}

function shouldSkipByFrequency(surveyId: string, freq?: ActiveSurvey["display_config"]["frequency"]): boolean {
  if (!freq) return false
  const st = getSurveyState(surveyId)
  switch (freq.type) {
    case "once":
      // Đã hiện rồi (kể cả chỉ shown chưa trả lời) → không hiện nữa
      return !!st.lastShownAt
    case "once_per_n_days": {
      const days = Number(freq.value) || 1
      if (!st.lastShownAt) return false
      return Date.now() - st.lastShownAt < days * ONE_DAY_MS
    }
    case "until_answered":
      // Hỏi tới khi trả lời (server đã filter completed). Client chỉ check cooldown sau dismiss.
      return false
    case "every_session":
      return !!st.sessionShownAt
    default:
      return false
  }
}

function shouldSkipByDismiss(surveyId: string, dc: ActiveSurvey["display_config"]): boolean {
  const st = getSurveyState(surveyId)
  const dismissCount = st.dismissCount ?? 0
  if (dc.max_dismissals != null && dc.max_dismissals > 0 && dismissCount >= dc.max_dismissals) {
    return true
  }
  const cooldownDays = Number(dc.cooldown_days_after_dismiss) || 0
  if (cooldownDays > 0 && st.lastDismissedAt) {
    if (Date.now() - st.lastDismissedAt < cooldownDays * ONE_DAY_MS) return true
  }
  return false
}

/** Xoá param ?survey= khỏi URL (không reload) sau khi đã xử lý link khảo sát. */
function stripSurveyParam(): void {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (!url.searchParams.has("survey")) return
  url.searchParams.delete("survey")
  window.history.replaceState(window.history.state, "", url.toString())
}

export function SurveyProvider() {
  const pathname = usePathname() || "/"
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null)
  const [visible, setVisible] = useState(false)
  const triggerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitListenerRef = useRef<((e: MouseEvent) => void) | null>(null)
  const fetchedOnceRef = useRef(false)
  const forcedRef = useRef(false)

  // Tăng visit count 1 lần / mount
  useEffect(() => {
    bumpVisitCount()
  }, [])

  // Fetch active survey 1 lần (khi pathname đổi nhưng survey đã match path → không refetch)
  useEffect(() => {
    if (fetchedOnceRef.current) return
    // Tránh hiện trên trang quản trị / login
    if (pathname.startsWith("/admin") || pathname.startsWith("/login")) return
    fetchedOnceRef.current = true

    // Link khảo sát trực tiếp (?survey=<slug>): mở là phải trả lời — popup không đóng được,
    // bỏ qua trigger/tần suất/audience. Trừ khi đã trả lời trong cửa sổ reask_days (server
    // trả survey = null) → gỡ param và quay về luồng khảo sát thường.
    const slug =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("survey")?.trim().toLowerCase() || null
        : null
    const fallbackToActive = () =>
      getActiveSurvey()
        .then((r) => {
          if (r.survey) setSurvey(r.survey)
        })
        .catch(() => {})

    if (slug) {
      getSurveyBySlug(slug)
        .then((r) => {
          if (r.survey) {
            forcedRef.current = true
            setSurvey({
              ...r.survey,
              display_config: {
                ...r.survey.display_config,
                dismissible: false,
                position: "center",
              },
            })
            markShown(r.survey.id)
            logSurveyImpression(r.survey.id, "shown")
            setVisible(true)
          } else {
            stripSurveyParam()
            fallbackToActive()
          }
        })
        .catch(() => {
          stripSurveyParam()
          fallbackToActive()
        })
      return
    }

    fallbackToActive()
  }, [pathname])

  // Setup trigger khi có survey (luồng link trực tiếp đã tự setVisible — bỏ qua gating ở đây)
  useEffect(() => {
    if (!survey) return
    if (visible || forcedRef.current) return

    const dc = survey.display_config || {}

    // Page filter
    if (!pathMatches(dc.pages_include, pathname)) return
    if (dc.pages_exclude && dc.pages_exclude.length > 0) {
      if (pathMatches(dc.pages_exclude, pathname)) return
    }

    // Đã trả lời → chỉ gate theo chu kỳ hỏi lại (reask_days). Chưa trả lời → gate theo
    // tần suất hiển thị + cooldown khi đóng như cũ.
    const reaskSkip = shouldSkipByReask(survey.id, dc)
    if (reaskSkip !== null) {
      if (reaskSkip) return
    } else {
      if (shouldSkipByFrequency(survey.id, dc.frequency)) return
      if (shouldSkipByDismiss(survey.id, dc)) return
    }

    const trigger = dc.trigger || { type: "after_seconds", value: 5 }
    const showNow = () => {
      markShown(survey.id)
      logSurveyImpression(survey.id, "shown")
      setVisible(true)
    }

    const cleanup: Array<() => void> = []

    switch (trigger.type) {
      case "on_load":
        showNow()
        break
      case "after_seconds": {
        const ms = Math.max(0, Number(trigger.value) || 0) * 1000
        triggerTimeoutRef.current = setTimeout(showNow, ms)
        cleanup.push(() => triggerTimeoutRef.current && clearTimeout(triggerTimeoutRef.current))
        break
      }
      case "after_n_visits": {
        const need = Math.max(1, Number(trigger.value) || 1)
        if (getVisitCount() >= need) showNow()
        break
      }
      case "on_exit_intent": {
        const handler = (e: MouseEvent) => {
          if (e.clientY <= 0) {
            showNow()
            if (exitListenerRef.current) document.removeEventListener("mouseleave", exitListenerRef.current)
          }
        }
        exitListenerRef.current = handler
        document.addEventListener("mouseleave", handler)
        cleanup.push(() => document.removeEventListener("mouseleave", handler))
        break
      }
    }

    return () => {
      cleanup.forEach((fn) => fn())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey, pathname])

  if (!survey || !visible) return null

  return (
    <SurveyPopup
      survey={survey}
      onClose={() => {
        setVisible(false)
        // Link trực tiếp: sau khi trả lời xong (popup không đóng được nếu chưa nộp),
        // gỡ ?survey= khỏi URL để reload/back không kích hoạt lại.
        if (forcedRef.current) {
          forcedRef.current = false
          stripSurveyParam()
        }
        // Sau khi đóng, không refetch — ẩn cho đến lần load page kế tiếp
      }}
    />
  )
}
