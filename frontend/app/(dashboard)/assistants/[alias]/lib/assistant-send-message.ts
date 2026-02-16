"use client";

import { API_CONFIG } from "@/lib/config";
import { fetchWithTimeout, SEND_TIMEOUT_MS } from "@/lib/fetch-utils";
import { getOrCreateGuestDeviceId, setGuestAlreadySentForAssistant } from "@/lib/guest-device-id";

export type SendMessageDocument = { url: string; name?: string };

export type CreateSendMessageHandlerOptions = {
  ensureSessionId: () => string;
  getDocumentList: () => SendMessageDocument[];
  clearUploadedFiles?: () => void;
  assistant: { baseUrl?: string; alias: string };
  userEmail: string | null;
  isLoggedIn: boolean;
  activeProject: { id?: string | number | null; name?: string | null; file_keys?: string[] } | null;
  getProjectFileUrl: (key: string) => string;
};

export function createSendMessageHandler(
  options: CreateSendMessageHandlerOptions
): (prompt: string | null, modelId: string, signal?: AbortSignal) => Promise<string | { content: string; meta?: { agents?: unknown[] }; messageId?: string }> {
  const {
    ensureSessionId,
    getDocumentList,
    clearUploadedFiles,
    assistant,
    userEmail,
    isLoggedIn,
    activeProject,
    getProjectFileUrl,
  } = options;
  const backendUrl = API_CONFIG.baseUrl;

  return async (prompt: string | null, modelId: string, signal?: AbortSignal) => {
    const trimmed = (prompt ?? "").replace(/\s+/g, " ").trim();
    const sessionTitle = trimmed ? trimmed.slice(0, 60) : "File đính kèm";
    const currentSid = ensureSessionId();
    const documentList = getDocumentList();
    clearUploadedFiles?.();

    const requestBody = {
      assistant_base_url: assistant.baseUrl,
      assistant_alias: assistant.alias,
      session_title: sessionTitle,
      user_id: userEmail,
      ...(isLoggedIn ? {} : { guest_device_id: getOrCreateGuestDeviceId() }),
      model_id: modelId,
      prompt,
      user: "demo-user",
      project_id: activeProject?.id ?? null,
      context: {
        language: "vi",
        project: activeProject?.name ?? "demo-project",
        project_id: activeProject?.id ?? null,
        extra_data: { document: documentList },
      },
    };

    try {
      const res = await fetchWithTimeout(
        `${backendUrl}/api/chat/sessions/${currentSid}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: signal ?? undefined,
          timeoutMs: SEND_TIMEOUT_MS,
        }
      );

      if (!res.ok) {
        let errorText = "";
        try {
          errorText = await res.text();
        } catch (_) {}
        let errorMessage = `HTTP ${res.status}: ${res.statusText || "Unknown error"}`;
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson?.message || errorJson?.error || errorMessage;
          } catch (_) {}
        }
        if (res.status === 429 && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-quota"));
        }
        if (res.status === 0 || res.status === 503) {
          errorMessage = "Backend server không khả dụng. Vui lòng kiểm tra backend có đang chạy không.";
        } else if (res.status === 502) {
          errorMessage = "Lỗi kết nối đến AI agent. " + errorMessage;
        } else if (res.status === 400) {
          errorMessage = "Yêu cầu không hợp lệ. " + errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseText = await res.text();
      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Backend trả về response không hợp lệ");
      }

      if (json?.status === "success") {
        if (!isLoggedIn) setGuestAlreadySentForAssistant(assistant.alias);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-quota"));
          window.dispatchEvent(new CustomEvent("chat-message-sent", { detail: { sessionId: currentSid } }));
        }
        const content = json.content_markdown || "";
        const agents = json?.meta?.agents;
        const messageId = json.assistant_message_id ?? undefined;
        if (agents?.length || messageId) {
          return { content, ...(agents?.length ? { meta: { agents } } : {}), ...(messageId ? { messageId } : {}) };
        }
        return content;
      }
      throw new Error(json?.error || "Send failed");
    } catch (err: any) {
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        const message =
          err.message.includes("Failed to fetch") || err.message.includes("NetworkError")
            ? `Không thể kết nối đến backend tại ${backendUrl}. Kiểm tra backend có đang chạy không.`
            : "Lỗi kết nối mạng: " + err.message;
        throw new Error(message);
      }
      throw err;
    }
  };
}
