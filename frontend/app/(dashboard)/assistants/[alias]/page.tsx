// app/assistants/[alias]/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { ChatInterfaceHandle } from "@/components/chat-interface";
import { WriteApplicationView } from "@/components/applications/write";
import { DataApplicationView } from "@/components/applications/data";
import { FloatingChatWidget, isFloatingChatAlias } from "@/components/floating-chat-widget";
import { useAssistant, useAssistants } from "@/hooks/use-assistants";
import { useActiveProject } from "@/contexts/active-project-context";
import { getProjectFileUrl } from "@/lib/api/projects";
import { fetchChatSessions } from "@/lib/chat";
import type { ChatSessionDTO } from "@/lib/chat";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssistantSession } from "./hooks/use-assistant-session";
import { useAssistantData } from "./hooks/use-assistant-data";
import { CentralProjectChatView } from "@/components/assistants/CentralProjectChatView";
import { GenericAssistantView } from "@/components/assistants/GenericAssistantView";

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Đang tải…</div>}>
      <AssistantPageImpl />
    </Suspense>
  );
}

type UploadedFile = {
  name: string;
  url?: string;
  status: "uploading" | "done" | "error";
};

function AssistantPageImpl() {
  const chatRef = useRef<ChatInterfaceHandle>(null);
  const params = useParams();
  const aliasParam = Array.isArray(params?.alias) ? params.alias[0] : (params?.alias ?? "");
  const searchParams = useSearchParams();

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [hasMessages, setHasMessages] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [centralProjectHasMessages, setCentralProjectHasMessages] = useState(false);
  const [selectedAssistantInProject, setSelectedAssistantInProject] = useState<{
    alias: string;
    name: string;
    icon?: string;
  } | null>(null);
  const [dataAnalyses, setDataAnalyses] = useState<ChatSessionDTO[]>([]);
  const [dataAnalysesLoading, setDataAnalysesLoading] = useState(false);
  const [selectedDataAnalysisId, setSelectedDataAnalysisId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "list">("list");

  const { data: session } = useSession();
  const { activeProject } = useActiveProject();
  const { sid, ensureSessionId, verifiedSid } = useAssistantSession(
    aliasParam,
    session?.user?.email,
    activeProject?.id != null ? String(activeProject.id) : undefined
  );

  useEffect(() => {
    if (!sid) return;
    setHasMessages(false);
    setIsCollapsed(true);
    setCentralProjectHasMessages(false);
  }, [sid]);

  const { assistant, loading: assistantLoading } = useAssistant(aliasParam || null);
  const { assistants: allAssistants } = useAssistants();

  const chatAssistantsForProject = useMemo(
    () =>
      allAssistants
        .filter((a) => !["central", "main", "write", "data"].includes(a.alias) && a.health === "healthy")
        .map((a) => ({ alias: a.alias, name: a.name ?? a.alias, icon: (a as { icon?: string }).icon })),
    [allAssistants]
  );

  useEffect(() => {
    setCentralProjectHasMessages(false);
    setSelectedAssistantInProject(null);
  }, [activeProject?.id]);

  useEffect(() => {
    const rid = searchParams.get("rid")?.trim();
    if (aliasParam !== "data" || !rid) {
      setDataAnalyses([]);
      setSelectedDataAnalysisId(null);
      return;
    }
    let cancelled = false;
    setDataAnalysesLoading(true);
    fetchChatSessions({ projectId: rid, assistantAlias: "data", limit: 50, offset: 0 })
      .then((res) => {
        if (!cancelled) setDataAnalyses(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDataAnalyses([]);
      })
      .finally(() => {
        if (!cancelled) setDataAnalysesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aliasParam, searchParams]);

  const dataHook = useAssistantData(assistant ?? null);
  const {
    dataTypes,
    activeType,
    setActiveType,
    isLoading,
    itemsByType,
    loadingByType,
    setIsLoading,
    setItemsByType,
    setLoadingByType,
  } = dataHook;

  useEffect(() => {
    if (!assistant) return;
    setIsCollapsed(true);
    setHasMessages(false);
  }, [assistant?.alias]);

  const sampleSuggestions = useMemo(() => {
    const prompts = assistant?.sample_prompts ?? [];
    if (prompts.length <= 4) return prompts;
    const copy = [...prompts];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, 4);
  }, [assistant?.alias, assistant?.sample_prompts]);

  const isCentralAssistant = aliasParam === "central";
  const isWriteAssistant = aliasParam === "write";
  const isDataAssistant = aliasParam === "data";
  const openFloatingFromUrl = searchParams.get("openFloating") === "1";
  const centralHasRid = isCentralAssistant && !!searchParams.get("rid");

  if (isCentralAssistant && centralHasRid && !activeProject) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center text-muted-foreground">
        <p className="text-sm">Đang tải dự án…</p>
      </div>
    );
  }

  if (isCentralAssistant && activeProject) {
    return (
      <CentralProjectChatView
        activeProject={activeProject}
        assistant={assistant}
        sessionUserEmail={session?.user?.email ?? null}
        isLoggedIn={!!session?.user}
        sid={sid}
        verifiedSid={verifiedSid}
        ensureSessionId={ensureSessionId}
        chatRef={chatRef}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        chatAssistantsForProject={chatAssistantsForProject}
        allAssistants={allAssistants}
        selectedAssistantInProject={selectedAssistantInProject}
        setSelectedAssistantInProject={setSelectedAssistantInProject}
        centralProjectHasMessages={centralProjectHasMessages}
        setCentralProjectHasMessages={setCentralProjectHasMessages}
        getProjectFileUrl={getProjectFileUrl}
      />
    );
  }

  if (isWriteAssistant) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <WriteApplicationView />
        <FloatingChatWidget
          alias="write"
          title={assistant?.name ?? "Viết bài"}
          defaultOpen={openFloatingFromUrl}
        />
      </div>
    );
  }

  if (isDataAssistant) {
    const dataProjectId = searchParams.get("rid")?.trim() || undefined;
    const hasDataProject = dataProjectId && /^[0-9a-f-]{36}$/i.test(dataProjectId);
    const formatAnalysisTitle = (s: ChatSessionDTO) => {
      if (s.title?.trim()) return s.title.trim();
      const d = s.updated_at ? new Date(s.updated_at) : new Date(s.created_at);
      return `Phân tích ${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
    };
    return (
      <div className="flex h-full min-h-0 flex-col">
        {hasDataProject && (
          <div className="flex-shrink-0 h-9 px-3 flex items-center gap-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-sm">
            <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-muted-foreground shrink-0">Phân tích:</span>
            <Select
              value={selectedDataAnalysisId ?? "__new__"}
              onValueChange={(v) => setSelectedDataAnalysisId(v === "__new__" ? null : v)}
              disabled={dataAnalysesLoading}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder={dataAnalysesLoading ? "Đang tải…" : "Chọn phân tích"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__" className="text-xs">
                  Phân tích mới
                </SelectItem>
                {dataAnalyses.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {formatAnalysisTitle(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs shrink-0"
              onClick={() => setSelectedDataAnalysisId(null)}
            >
              Tạo phân tích mới
            </Button>
          </div>
        )}
        <DataApplicationView
          projectFiles={
            hasDataProject &&
            activeProject &&
            String(activeProject.id) === dataProjectId &&
            (activeProject.file_keys?.length ?? 0) > 0
              ? (activeProject.file_keys ?? []).map((key) => ({
                  key,
                  name: key.split("/").pop() || key,
                  url: getProjectFileUrl(key),
                }))
              : undefined
          }
        />
        <FloatingChatWidget
          alias="data"
          title="Trợ lý Dữ liệu"
          projectId={dataProjectId}
          sessionId={hasDataProject ? selectedDataAnalysisId ?? null : undefined}
        />
      </div>
    );
  }

  if (assistantLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Đang tải thông tin trợ lý...</div>;
  }

  if (!assistant) {
    return (
      <div className="p-6">
        Không tìm thấy trợ lý với alias: <b>{String(aliasParam)}</b>
      </div>
    );
  }

  const greetingName = session?.user?.name || session?.user?.email || "bạn";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <GenericAssistantView
        assistant={assistant}
        sid={sid}
        verifiedSid={verifiedSid}
        isLoggedIn={!!session?.user}
        sessionUserEmail={session?.user?.email ?? null}
        activeProject={activeProject ?? null}
        hasMessages={hasMessages}
        isCollapsed={isCollapsed}
        setHasMessages={setHasMessages}
        setIsCollapsed={setIsCollapsed}
        itemsByType={itemsByType}
        activeType={activeType}
        setActiveType={setActiveType}
        viewMode={viewMode}
        setViewMode={setViewMode}
        dataTypes={dataTypes}
        isLoading={isLoading}
        loadingByType={loadingByType}
        sampleSuggestions={sampleSuggestions}
        chatRef={chatRef}
        uploadedFiles={uploadedFiles}
        setUploadedFiles={setUploadedFiles}
        ensureSessionId={ensureSessionId}
        getProjectFileUrl={getProjectFileUrl}
        greetingName={greetingName}
        useFloatingChat={isFloatingChatAlias(aliasParam)}
      />
      {isFloatingChatAlias(aliasParam) && (
        <FloatingChatWidget alias={aliasParam} title={assistant.name} />
      )}
    </div>
  );
}
