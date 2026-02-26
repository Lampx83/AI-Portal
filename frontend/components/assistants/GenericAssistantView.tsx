"use client";

import { RefObject } from "react";
import {
  LayoutGrid,
  List,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChatInterface, ChatInterfaceHandle } from "@/components/chat-interface";
import { ChatSuggestions } from "@/components/chat-suggestions";
import { AssistantDataPane } from "@/components/assistant-data-pane";
import { createSendMessageHandler } from "@/app/(dashboard)/assistants/[alias]/lib/assistant-send-message";
import { useLanguage } from "@/contexts/language-context";
import type { Project } from "@/types";

export type UploadedFile = {
  name: string;
  url?: string;
  status: "uploading" | "done" | "error";
};

type GenericAssistantViewProps = {
  assistant: {
    name: string;
    alias: string;
    baseUrl?: string;
    description?: string;
    Icon?: React.ComponentType<{ className?: string }>;
    supported_models?: { model_id: string; name: string }[];
  };
  sid: string;
  verifiedSid: string | null;
  isLoggedIn: boolean;
  sessionUserEmail: string | null;
  activeProject: Project | null;
  hasMessages: boolean;
  isCollapsed: boolean;
  setHasMessages: (v: boolean) => void;
  setIsCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  itemsByType: Record<string, any[]>;
  activeType: string;
  setActiveType: (v: string) => void;
  viewMode: "card" | "list";
  setViewMode: (v: "card" | "list") => void;
  dataTypes: { type: string; label: string }[];
  isLoading: boolean;
  loadingByType: Record<string, boolean>;
  sampleSuggestions: string[];
  chatRef: RefObject<ChatInterfaceHandle | null>;
  uploadedFiles: (UploadedFile & { url?: string })[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  ensureSessionId: () => string;
  getProjectFileUrl: (key: string) => string;
  greetingName?: string;
  /** Khi true, không render ChatInterface (page sẽ render FloatingChatWidget). */
  useFloatingChat?: boolean;
};

export function GenericAssistantView({
  assistant,
  sid,
  verifiedSid,
  isLoggedIn,
  sessionUserEmail,
  activeProject,
  hasMessages,
  isCollapsed,
  setHasMessages,
  setIsCollapsed,
  itemsByType,
  activeType,
  setActiveType,
  viewMode,
  setViewMode,
  dataTypes,
  isLoading,
  loadingByType,
  sampleSuggestions,
  chatRef,
  uploadedFiles,
  setUploadedFiles,
  ensureSessionId,
  getProjectFileUrl,
  greetingName = "bạn",
  useFloatingChat = false,
}: GenericAssistantViewProps) {
  const { t } = useLanguage();
  const effectiveSid = isLoggedIn ? verifiedSid : sid;
  const chatKey = effectiveSid || "no-sid";
  const itemsCurrent = itemsByType[activeType] ?? [];
  const isOrchestrator = assistant.alias === "central";
  const headerTitle = isOrchestrator ? `Xin chào, ${greetingName} 👋` : assistant.name;
  const headerSubtitle = isOrchestrator ? "Bạn đã sẵn sàng khám phá chưa?" : assistant.description || "";
  const shouldShowSuggestions =
    !!sampleSuggestions.length && !hasMessages && (isOrchestrator || isCollapsed || !activeType);

  const getDocumentList = () => {
    const uploadedDocs = uploadedFiles.filter((f): f is UploadedFile & { url: string } => !!f.url).map((f) => ({ url: f.url, name: f.name }));
    const projectDocs = (activeProject?.file_keys ?? []).map((key) => ({
      url: getProjectFileUrl(key),
      name: key.split("/").pop() || key,
    }));
    return [...uploadedDocs, ...projectDocs];
  };

  const onSendMessage = createSendMessageHandler({
    ensureSessionId,
    getDocumentList,
    clearUploadedFiles: () => setUploadedFiles([]),
    assistant: { baseUrl: assistant.baseUrl, alias: assistant.alias },
    userEmail: sessionUserEmail,
    isLoggedIn,
    activeProject,
    getProjectFileUrl,
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

  const toggleCollapse = () => setIsCollapsed((p) => !p);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {!isOrchestrator && (
        <div className="flex justify-between items-center h-14 px-4 bg-gray-50 dark:bg-gray-900/50 border-b flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {assistant.Icon && <assistant.Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />}
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{assistant.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isCollapsed && !!activeType && (
              <>
                <Button
                  variant={viewMode === "card" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("card")}
                  aria-label="Xem dạng thẻ"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                  aria-label="Xem dạng bảng"
                >
                  <List className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="h-8 cursor-pointer" onClick={toggleCollapse}>
              {isCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />Xem dữ liệu
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" /> Thu gọn
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {!isOrchestrator && !isCollapsed && (
        <div className="flex-1 min-h-0 transition-all duration-300 overflow-auto">
          <div className="h-full p-4 sm:p-6 lg:p-8">
            <div className="flex h-full w-full max-w-none flex-col min-h-0">
              <div className="mb-4">
                <h1 className="text-2xl font-bold">{headerTitle}</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{headerSubtitle}</p>
              </div>
              {dataTypes.length > 1 ? (
                <Tabs value={activeType} onValueChange={setActiveType} className="flex-1 min-h-0 flex flex-col">
                  <TabsList className="mb-4 w-full overflow-auto">
                    {dataTypes.map((dt) => (
                      <TabsTrigger key={dt.type} value={dt.type} className="whitespace-nowrap">
                        {dt.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {dataTypes.map((dt) => (
                    <TabsContent key={dt.type} value={dt.type} className="flex-1 min-h-0">
                      <AssistantDataPane
                        items={dt.type === activeType ? itemsCurrent : itemsByType[dt.type] ?? []}
                        isLoading={dt.type === activeType ? isLoading || !!loadingByType[dt.type] : !!loadingByType[dt.type]}
                        viewMode={viewMode}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <AssistantDataPane
                  items={itemsCurrent}
                  isLoading={isLoading || !!loadingByType[activeType]}
                  viewMode={viewMode}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {shouldShowSuggestions && (
        <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-4">
          <ChatSuggestions
            suggestions={sampleSuggestions}
            onSuggestionClick={(s) => chatRef.current?.applySuggestion(s)}
            assistantName={assistant.name || ""}
            isCentral={assistant.alias === "central"}
          />
        </div>
      )}

      {(isCollapsed || isOrchestrator) && !useFloatingChat && (
        <div
          className={
            shouldShowSuggestions
              ? "flex-shrink-0 min-h-[120px] flex flex-col overflow-hidden"
              : "flex-1 min-h-0 flex flex-col overflow-hidden"
          }
        >
          <ChatInterface
            key={chatKey}
            ref={chatRef}
            className="h-full min-h-0 flex flex-col bg-background"
            assistantName={assistant.name}
            assistantAlias={assistant.alias}
            projectContext={activeProject ?? null}
            sessionId={effectiveSid ?? undefined}
            onMessagesChange={(count) => {
              const has = count > 0;
              const wasEmpty = !hasMessages;
              setHasMessages(has);
              if (has && wasEmpty) setIsCollapsed(true);
            }}
            onChatStart={() => {
              ensureSessionId();
              setIsCollapsed(true);
              setHasMessages(true);
            }}
            onFileUploaded={(f) => setUploadedFiles((prev) => [...prev, { ...f, status: "done" }])}
            uploadedFiles={uploadedFiles
              .filter((f): f is UploadedFile & { url: string } => !!f.url)
              .map((f) => ({ name: f.name, url: f.url, status: f.status }))}
            onClearUploadedFiles={() => setUploadedFiles([])}
            onSendMessage={onSendMessage}
            models={(assistant.supported_models || []).map((m) => ({ model_id: m.model_id, name: m.name }))}
          />
        </div>
      )}
    </div>
  );
}
