"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { getActiveSurvey, logSurveyImpression, type ActiveSurvey } from "@/lib/api/surveys"
import {
  bumpVisitCount,
  getSurveyState,
  getVisitCount,
  markShown,
} from "@/lib/survey-storage"
import { SurveyPopup } from "./SurveyPopup"

const ONE_DAY_MS = 24 * 60 * 60 * 1000

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

export function SurveyProvider() {
  const pathname = usePathname() || "/"
  const [survey, setSurvey] = useState<ActiveSurvey | null>(null)
  const [visible, setVisible] = useState(false)
  const triggerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitListenerRef = useRef<((e: MouseEvent) => void) | null>(null)
  const fetchedOnceRef = useRef(false)

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
    getActiveSurvey()
      .then((r) => {
        if (r.survey) setSurvey(r.survey)
      })
      .catch(() => {})
  }, [pathname])

  // Setup trigger khi có survey
  useEffect(() => {
    if (!survey) return
    if (visible) return

    const dc = survey.display_config || {}

    // Page filter
    if (!pathMatches(dc.pages_include, pathname)) return
    if (dc.pages_exclude && dc.pages_exclude.length > 0) {
      if (pathMatches(dc.pages_exclude, pathname)) return
    }

    // Frequency / dismiss
    if (shouldSkipByFrequency(survey.id, dc.frequency)) return
    if (shouldSkipByDismiss(survey.id, dc)) return

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
        // Sau khi đóng, không refetch — ẩn cho đến lần load page kế tiếp
      }}
    />
  )
}
