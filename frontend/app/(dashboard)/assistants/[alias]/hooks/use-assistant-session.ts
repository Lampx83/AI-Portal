"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage";
import { safeRandomUUID } from "@/lib/crypto-polyfill";
import {
  fetchChatSession,
  GUEST_USER_ID,
} from "@/lib/chat";

/**
 * Quản lý session ID đồng bộ với URL (sid), xác minh session khi đã đăng nhập (tránh hiển thị session khách).
 */
export function useAssistantSession(
  aliasParam: string,
  sessionUserEmail: string | null | undefined,
  activeProjectId: string | null | undefined,
  sessionUserId?: string | null
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string>(() => searchParams.get("sid") || "");
  const sidEnsuredRef = useRef(false);
  const [verifiedSid, setVerifiedSid] = useState<string | null>(null);
  // sid (của khách) → sid mới đã tạo cho user thật: mỗi sid chỉ được thay thế tối đa một lần.
  const migratedSidsRef = useRef<Map<string, string>>(new Map());
  // Tài khoản Khách sở hữu session thuộc bucket GUEST_USER_ID: không có gì để chuyển sang.
  const viewerIsGuest = sessionUserId === GUEST_USER_ID;

  useEffect(() => {
    sidEnsuredRef.current = false;
  }, [aliasParam]);

  useEffect(() => {
    const currentSid = searchParams.get("sid");
    if (currentSid) {
      setSessionId(currentSid);
      return;
    }
    if (sidEnsuredRef.current) return;
    const stored = getStoredSessionId(aliasParam);
    if (stored) {
      const sp = new URLSearchParams(searchParams?.toString() || "");
      sp.set("sid", stored);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      setSessionId(stored);
      sidEnsuredRef.current = true;
      return;
    }
    const newSid = safeRandomUUID();
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("sid", newSid);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    setSessionId(newSid);
    sidEnsuredRef.current = true;
  }, [pathname, aliasParam, router, searchParams]);

  useEffect(() => {
    if (aliasParam && sessionId) setStoredSessionId(aliasParam, sessionId);
  }, [aliasParam, sessionId]);

  useEffect(() => {
    setVerifiedSid(null);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !sessionUserEmail) {
      if (!sessionUserEmail) setVerifiedSid(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchChatSession(sessionId);
        if (cancelled) return;
        // Session chưa có trong DB (sid vừa sinh ở trình duyệt): KHÔNG tạo ngay. Backend tự tạo khi gửi tin đầu tiên
        // (createSessionIfMissing ở POST /api/chat/.../messages). Tạo sớm làm ~94% phiên chat trống (22/10/2026: 16.192 phiên khách).
        if (!s) {
          if (!cancelled) setVerifiedSid(sessionId);
          return;
        }
        if (!viewerIsGuest && String(s.user_id) === GUEST_USER_ID) {
          // Session khách + người xem là user thật → chuyển sang session mới (một lần cho mỗi sid).
          // Sid mới sinh ở trình duyệt, chưa tạo trong DB: phiên chỉ có khi người dùng gửi tin đầu tiên.
          let newSid = migratedSidsRef.current.get(sessionId);
          if (!newSid) {
            newSid = safeRandomUUID();
            migratedSidsRef.current.set(sessionId, newSid);
          }
          if (cancelled) return;
          setStoredSessionId(aliasParam, newSid);
          const sp = new URLSearchParams(searchParams?.toString() || "");
          sp.set("sid", newSid);
          router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
          setSessionId(newSid);
          setVerifiedSid(newSid);
        } else {
          if (!cancelled) setVerifiedSid(sessionId);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("Replace guest session failed:", e);
          setVerifiedSid(sessionId);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    sessionUserEmail,
    aliasParam,
    pathname,
    searchParams,
    router,
    activeProjectId,
    viewerIsGuest,
  ]);

  const sid = searchParams.get("sid") || sessionId || "";

  const ensureSessionId = () => {
    if (searchParams.get("sid")) return searchParams.get("sid")!;
    const newSid = safeRandomUUID();
    setSessionId(newSid);
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("sid", newSid);
    router.replace(`${pathname}?${sp.toString()}`);
    return newSid;
  };

  return { sid, setSessionId, ensureSessionId, verifiedSid };
}
