"use client"

import { useRef, useMemo } from "react"
import { useSession } from "next-auth/react"
import type { Session } from "next-auth"
import { GUEST_USER_ID } from "@/lib/chat"

/** Thời gian (ms) giữ session SSO/thật trước khi chấp nhận session guest — tránh nháy từ SSO sang Guest do race/refetch. */
const STICKY_REAL_SESSION_MS = 60_000

function isGuestSession(session: Session | null): boolean {
  if (!session?.user) return false
  const id = (session.user as { id?: string }).id
  return id === GUEST_USER_ID
}

/**
 * Session ổn định: khi đã có session thật (SSO/user), không chuyển sang hiển thị Guest trong một khoảng thời gian
 * nếu refetch trả về guest (do race hoặc lỗi). Tránh hiện tượng "SSO hiển thị rồi biến mất, thay bằng Guest".
 */
export function useStableSession() {
  const { data: session, status } = useSession()
  const lastRealSessionRef = useRef<Session | null>(null)
  const lastRealSessionTimeRef = useRef<number>(0)

  return useMemo(() => {
    if (status === "loading" || session === undefined) {
      return { data: session, status }
    }
    if (session === null) {
      lastRealSessionRef.current = null
      return { data: null, status }
    }
    if (!isGuestSession(session)) {
      lastRealSessionRef.current = session
      lastRealSessionTimeRef.current = Date.now()
      return { data: session, status }
    }
    // Session hiện tại là guest
    const lastReal = lastRealSessionRef.current
    const lastTime = lastRealSessionTimeRef.current
    const now = Date.now()
    if (lastReal && now - lastTime < STICKY_REAL_SESSION_MS) {
      // Ưu tiên giữ hiển thị session thật để tránh nháy sang Guest
      return { data: lastReal, status }
    }
    return { data: session, status }
  }, [session, status])
}
