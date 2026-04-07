"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Bot } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssistants } from "@/hooks/use-assistants";
import { useAssistant } from "@/hooks/use-assistants";
import { useLanguage } from "@/contexts/language-context";
import type { Assistant } from "@/lib/assistants";
import { useSession } from "next-auth/react";
import { ChatInterface } from "@/components/chat-interface";
import { createSendMessageHandler } from "@/app/(dashboard)/assistants/[alias]/lib/assistant-send-message";
import { safeRandomUUID } from "@/lib/crypto-polyfill";
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage";
import { FloatingEmbedDialog } from "@/components/embed/floating-embed-dialog";

const FLOATING_CHAT_ALIASES = [] as const;
export type FloatingChatAlias = (typeof FLOATING_CHAT_ALIASES)[number];

export function isFloatingChatAlias(alias: string): alias is FloatingChatAlias {
  return FLOATING_CHAT_ALIASES.includes(alias as FloatingChatAlias);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FloatingChatWidgetProps {
  alias: string;
  title?: string;
  /** Open chat window by default (e.g. from history with openFloating=1) */
  defaultOpen?: boolean;
  /** Show expand/collapse button to enlarge the floating panel in place (does not navigate away). */
  allowExpandToFullPage?: boolean;
  /** Project id (rid) — for embed so each session is tied to project */
  projectId?: string;
  /** Session id — when set, embed opens that session; otherwise new session */
  sessionId?: string | null;
}

export function FloatingChatWidget({
  alias,
  title,
  defaultOpen = false,
  allowExpandToFullPage = false,
  projectId,
  sessionId,
}: FloatingChatWidgetProps) {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const defaultTitle = t("chat.assistantAI");
  const effectiveDefaultTitle = title ?? defaultTitle;
  const [open, setOpen] = useState(defaultOpen);
  const [sid, setSid] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; status?: string }>>([]);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const isCentral = alias === "central";
  const [selectedAlias, setSelectedAlias] = useState<string>(alias);
  const { assistants } = useAssistants();

  const effectiveAlias = isCentral ? selectedAlias : alias;
  const resolvedAssistantName = useMemo(() => {
    const item = assistants.find((x) => x.alias === effectiveAlias);
    return item?.name?.trim() || "";
  }, [assistants, effectiveAlias]);
  const { assistant, loading: assistantLoading } = useAssistant(effectiveAlias || null);
  const assistantDisplayName = (assistant?.name ?? "").trim();
  const effectiveTitle = useMemo(() => {
    if (!isCentral) return assistantDisplayName || resolvedAssistantName || effectiveDefaultTitle;
    const a = assistants.find((x) => x.alias === selectedAlias);
    return a?.name ?? (selectedAlias === "central" ? t("chat.assistantCentral") : selectedAlias);
  }, [isCentral, selectedAlias, assistants, effectiveDefaultTitle, t, resolvedAssistantName, assistantDisplayName]);

  useEffect(() => {
    if (!effectiveAlias) return;
    const fromProp = typeof sessionId === "string" && UUID_RE.test(sessionId) ? sessionId : "";
    const fromStorage = getStoredSessionId(effectiveAlias);
    const nextSid = fromProp || fromStorage || safeRandomUUID();
    setSid(nextSid);
    setStoredSessionId(effectiveAlias, nextSid);
  }, [effectiveAlias, sessionId]);

  const ensureSessionId = useCallback((): string => {
    const existing = sid || (effectiveAlias ? getStoredSessionId(effectiveAlias) : "");
    if (existing) return existing;
    const nextSid = safeRandomUUID();
    setSid(nextSid);
    if (effectiveAlias) setStoredSessionId(effectiveAlias, nextSid);
    return nextSid;
  }, [sid, effectiveAlias]);

  const onSendMessage = useMemo(() => {
    return createSendMessageHandler({
      ensureSessionId,
      getDocumentList: () =>
        uploadedFiles
          .filter((f): f is { name: string; url: string; status?: string } => !!f.url)
          .map((f) => ({ url: f.url, name: f.name })),
      clearUploadedFiles: () => setUploadedFiles([]),
      assistant: { baseUrl: assistant?.baseUrl, alias: effectiveAlias },
      userEmail: session?.user?.email ?? null,
      isLoggedIn: !!session?.user,
      activeProject: projectId && UUID_RE.test(projectId) ? { id: projectId } : null,
      getProjectFileUrl: () => "",
      getErrorStrings: () => ({
        errorAgentConnection: t("chat.errorAgentConnection"),
        errorBackendUnavailable: t("chat.errorBackendUnavailable"),
        errorInvalidRequest: t("chat.errorInvalidRequest"),
        errorInvalidResponse: t("chat.errorInvalidResponse"),
        errorCannotConnectBackend: t("chat.errorCannotConnectBackend"),
        errorCentralLlmConfig: t("chat.errorCentralLlmConfig"),
        sessionTitleAttachment: t("chat.sessionTitleAttachment"),
      }),
    });
  }, [ensureSessionId, uploadedFiles, assistant?.baseUrl, effectiveAlias, session?.user, projectId, t]);

  // Assistants in dropdown (excluding Central — default when none selected)
  const optionsForSelect = useMemo(() => {
    return assistants
      .filter((a) => a.health === "healthy" && !["central", "main"].includes(a.alias))
      .sort((a, b) => (a.name ?? a.alias).localeCompare(b.name ?? b.alias));
  }, [assistants]);

  const selectedValid = optionsForSelect.some((a) => a.alias === selectedAlias);
  const valueForSelect = selectedValid ? selectedAlias : "";
  const floatingSampleSuggestions = useMemo(() => {
    const prompts = (assistant?.sample_prompts ?? [])
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean);
    if (prompts.length <= 2) return prompts;
    const shuffled = [...prompts];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 2);
  }, [assistant?.sample_prompts]);

  return (
    <>
      {/* Open chat button */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="fixed right-6 bottom-12 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg transition hover:scale-105 hover:shadow-xl hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        title={t("chat.openChatWithCentral")}
        aria-label={t("chat.openChat")}
      >
        <Bot className="h-7 w-7" />
      </button>

      {/* Floating chat window */}
      <FloatingEmbedDialog
        open={open}
        onClose={() => setOpen(false)}
        sizeExpandable={allowExpandToFullPage}
        expandLabel={t("common.expand")}
        collapseLabel={t("common.collapse")}
        title={effectiveTitle}
        headerContent={
          isCentral ? (
            optionsForSelect.length > 0 ? (
              <Select
                value={valueForSelect}
                onValueChange={(v) => setSelectedAlias(v || "central")}
              >
                <SelectTrigger
                  className="h-8 flex-1 min-w-0 border-white/30 bg-white/10 text-white [&>span]:truncate gap-2"
                  aria-label={t("chat.selectAssistant")}
                >
                  <SelectValue placeholder={t("chat.assistantCentral")} />
                </SelectTrigger>
                <SelectContent className="z-[10000]" position="popper">
                  {optionsForSelect.map((a) => {
                    const ItemIcon = "Icon" in a ? (a as Assistant).Icon : Bot;
                    const itemName = ("name" in a ? a.name : null) ?? a.alias;
                    return (
                      <SelectItem key={a.alias} value={a.alias} className="cursor-pointer">
                        <span className="flex items-center gap-2 w-full min-w-0 whitespace-nowrap">
                          <ItemIcon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{itemName}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <span className="truncate flex-1 font-semibold text-sm">{effectiveTitle}</span>
            )
          ) : (
            <span className="truncate flex-1 font-semibold text-sm">{effectiveTitle}</span>
          )
        }
      >
        {assistantLoading ? (
          <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : !assistant ? (
          <div className="flex flex-1 items-center justify-center p-4 text-sm text-muted-foreground">
            {t("chat.assistantNotFound") || "Không tìm thấy trợ lý."}
          </div>
        ) : (
          <ChatInterface
            key={`${effectiveAlias}-${sid || "no-sid"}`}
            className="h-full min-h-0 flex flex-col bg-background"
            assistantName={assistant.name ?? effectiveTitle}
            assistantAlias={assistant.alias}
            projectContext={null}
            sessionId={sid || undefined}
            forceFirstModel
            mergeMicIntoSendButton
            compactMessageText
            compactSuggestions
            onChatStart={() => {
              ensureSessionId();
            }}
            onFileUploaded={(f) => setUploadedFiles((prev) => [...prev, { ...f, status: "done" }])}
            uploadedFiles={uploadedFiles}
            onClearUploadedFiles={() => setUploadedFiles([])}
            onSendMessage={onSendMessage}
            models={(assistant.supported_models || []).map((m: { model_id: string; name?: string }) => ({
              model_id: m.model_id,
              name: m.name ?? m.model_id,
            }))}
            sampleSuggestions={floatingSampleSuggestions}
          />
        )}
      </FloatingEmbedDialog>
    </>
  );
}
