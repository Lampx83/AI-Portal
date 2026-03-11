"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage";
import { safeRandomUUID } from "@/lib/crypto-polyfill";
import {
  fetchChatSession,
  createChatSession,
  GUEST_USER_ID,
} from "@/lib/chat";

/**
 * Quản lý session ID đồng bộ với URL (sid), xác minh session khi đã đăng nhập (tránh hiển thị session khách).
 */
export function useAssistantSession(
  aliasParam: string,
  sessionUserEmail: string | null | undefined,
  activeProjectId: string | null | undefined
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sessionId, setSessionId] = useState<string>(() => searchParams.get("sid") || "");
  const sidEnsuredRef = useRef(false);
  const [verifiedSid, setVerifiedSid] = useState<string | null>(null);

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
        // Session không tồn tại (404): tạo session mới và cập nhật URL
        if (!s) {
          const newSession = await createChatSession({
            user_id: sessionUserEmail,
            project_id: activeProjectId ?? null,
            assistant_alias: aliasParam ?? null,
          });
          if (cancelled || !newSession?.id) return;
          setStoredSessionId(aliasParam, newSession.id);
          const sp = new URLSearchParams(searchParams?.toString() || "");
          sp.set("sid", newSession.id);
          router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
          setSessionId(newSession.id);
          setVerifiedSid(newSession.id);
          return;
        }
        if (String(s.user_id) === GUEST_USER_ID) {
          const newSession = await createChatSession({
            user_id: sessionUserEmail,
            project_id: activeProjectId ?? null,
          });
          if (cancelled || !newSession?.id) return;
          setStoredSessionId(aliasParam, newSession.id);
          const sp = new URLSearchParams(searchParams?.toString() || "");
          sp.set("sid", newSession.id);
          router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
          setSessionId(newSession.id);
          if (!cancelled) setVerifiedSid(newSession.id);
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
