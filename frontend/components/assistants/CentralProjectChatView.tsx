"use client";

import { RefObject } from "react";
import Link from "next/link";
import {
  BarChart3,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChatInterface, ChatInterfaceHandle } from "@/components/chat-interface";
import { ProjectCenterView } from "@/components/project-center-view";
import { getProjectIcon } from "@/lib/project-icons";
import { createSendMessageHandler } from "@/app/(dashboard)/assistants/[alias]/lib/assistant-send-message";
import { useLanguage } from "@/contexts/language-context";
import type { Project } from "@/types";

export type UploadedFile = {
  name: string;
  url?: string;
  status: "uploading" | "done" | "error";
};

type AssistantOption = { alias: string; name: string; icon?: string };

type CentralProjectChatViewProps = {
  activeProject: Project;
  assistant: { baseUrl?: string; name?: string; supported_models?: { model_id: string; name: string }[] } | null;
  sessionUserEmail: string | null;
  isLoggedIn: boolean;
  sid: string;
  verifiedSid: string | null;
  ensureSessionId: () => string;
  chatRef: RefObject<ChatInterfaceHandle | null>;
  uploadedFiles: (UploadedFile & { url?: string })[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  chatAssistantsForProject: AssistantOption[];
  allAssistants: { alias: string; name?: string; icon?: string }[];
  selectedAssistantInProject: { alias: string; name: string; icon?: string } | null;
  setSelectedAssistantInProject: (v: { alias: string; name: string; icon?: string } | null) => void;
  centralProjectHasMessages: boolean;
  setCentralProjectHasMessages: (v: boolean) => void;
  getProjectFileUrl: (key: string) => string;
  sampleSuggestions: string[];
};

export function CentralProjectChatView({
  activeProject,
  assistant,
  sessionUserEmail,
  isLoggedIn,
  sid,
  verifiedSid,
  ensureSessionId,
  chatRef,
  uploadedFiles,
  setUploadedFiles,
  chatAssistantsForProject,
  allAssistants,
  selectedAssistantInProject,
  setSelectedAssistantInProject,
  centralProjectHasMessages,
  setCentralProjectHasMessages,
  getProjectFileUrl,
  sampleSuggestions,
}: CentralProjectChatViewProps) {
  const { t } = useLanguage();
  const projectName = activeProject.name?.trim() || "Dự án";
  const projectIcon = (activeProject.icon?.trim() || "FolderKanban") as string;
  const ProjectIconComp = getProjectIcon(projectIcon);
  const projectRid = activeProject?.id != null ? String(activeProject.id) : "";
  const projectBaseQuery = projectRid ? `?rid=${encodeURIComponent(projectRid)}` : "";

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
    assistant: { baseUrl: assistant?.baseUrl, alias: "central" },
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

  const chatCommon = {
    onFileUploaded: (f: UploadedFile & { url?: string }) =>
      setUploadedFiles((prev) => [...prev, { ...f, status: "done" }]),
    uploadedFiles: uploadedFiles
      .filter((f): f is UploadedFile & { url: string } => !!f.url)
      .map((f) => ({ name: f.name, url: f.url, status: f.status })),
    onClearUploadedFiles: () => setUploadedFiles([]),
    onSendMessage,
    models: (assistant?.supported_models || []).map((m) => ({ model_id: m.model_id, name: m.name })),
    sampleSuggestions: sampleSuggestions.length > 0 ? sampleSuggestions : undefined,
  };

  const openEditProject = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-edit-project", { detail: activeProject }));
    }
  };

  const effectiveSid = isLoggedIn ? verifiedSid : sid;
  const chatKey = effectiveSid || "no-sid";

  if (centralProjectHasMessages) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="flex-shrink-0 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 px-4 py-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 shrink-0">
            <ProjectIconComp className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate min-w-0 w-24 sm:w-32">{projectName}</span>
          {chatAssistantsForProject.length > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Select
                value={selectedAssistantInProject?.alias ?? ""}
                onValueChange={(alias) => {
                  if (!alias) {
                    setSelectedAssistantInProject(null);
                    return;
                  }
                  const opt = chatAssistantsForProject.find((a) => a.alias === alias);
                  const a = allAssistants.find((x) => x.alias === alias);
                  setSelectedAssistantInProject(
                    a ? { alias: a.alias, name: a.name ?? a.alias, icon: a.icon } : opt ? { alias: opt.alias, name: opt.name } : { alias, name: alias }
                  );
                }}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs" title="Chọn trợ lý để chat (mặc định: Trợ lý chính)">
                  <SelectValue placeholder="Trợ lý chính" />
                </SelectTrigger>
                <SelectContent>
                  {chatAssistantsForProject.map((a) => (
                    <SelectItem key={a.alias} value={a.alias} className="text-xs">
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAssistantInProject && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setSelectedAssistantInProject(null)} title="Về Trợ lý chính" aria-label="Về Trợ lý chính">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-muted-foreground h-8" asChild>
            <Link href={`/assistants/data${projectBaseQuery}`} title="Phân tích dữ liệu">
              <BarChart3 className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-muted-foreground h-8" onClick={openEditProject} title="Chỉnh sửa dự án">
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa
          </Button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ChatInterface
            key={chatKey}
            ref={chatRef}
            className="h-full min-h-0 flex flex-col"
            assistantName={assistant?.name ?? "Trợ lý chính"}
            assistantAlias="central"
            projectContext={activeProject}
            sessionId={effectiveSid ?? undefined}
            onMessagesChange={(count) => setCentralProjectHasMessages(count > 0)}
            onChatStart={() => {
              ensureSessionId();
              setCentralProjectHasMessages(true);
            }}
            selectedAssistantForDisplay={selectedAssistantInProject}
            onClearSelectedAssistant={() => setSelectedAssistantInProject(null)}
            {...chatCommon}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <ProjectCenterView
          project={activeProject}
          chatAssistants={chatAssistantsForProject}
          onSelectAssistantForChat={(alias, name) => {
            const a = allAssistants.find((x) => x.alias === alias);
            setSelectedAssistantInProject(a ? { alias: a.alias, name: a.name ?? a.alias, icon: a.icon } : { alias, name });
          }}
        />
      </div>
      <div className="flex-shrink-0">
        <ChatInterface
          key={chatKey}
          ref={chatRef}
          className="flex flex-col"
          assistantName={assistant?.name ?? "Trợ lý chính"}
          assistantAlias="central"
          projectContext={activeProject}
          sessionId={effectiveSid ?? undefined}
          onMessagesChange={(count) => setCentralProjectHasMessages(count > 0)}
          onChatStart={() => {
            ensureSessionId();
            setCentralProjectHasMessages(true);
          }}
          selectedAssistantForDisplay={selectedAssistantInProject}
          onClearSelectedAssistant={() => setSelectedAssistantInProject(null)}
          {...chatCommon}
        />
      </div>
    </div>
  );
}
