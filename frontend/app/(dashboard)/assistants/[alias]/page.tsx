// app/assistants/[alias]/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { ChatInterfaceHandle } from "@/components/chat-interface";
import { FloatingChatWidget, isFloatingChatAlias } from "@/components/floating-chat-widget";
import { useAssistant, useAssistants } from "@/hooks/use-assistants";
import { useTools } from "@/hooks/use-tools";
import { useActiveProject } from "@/contexts/active-project-context";
import { getProjectFileUrl } from "@/lib/api/projects";
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
  const { tools: appTools } = useTools();
  const appToolWithDomain = appTools.find((t) => t.alias === aliasParam && (t as { domainUrl?: string }).domainUrl);

  const chatAssistantsForProject = useMemo(
    () =>
      allAssistants
        .filter((a) => !["central", "main"].includes(a.alias) && a.health === "healthy")
        .map((a) => ({ alias: a.alias, name: a.name ?? a.alias, icon: (a as { icon?: string }).icon })),
    [allAssistants]
  );

  useEffect(() => {
    setCentralProjectHasMessages(false);
    setSelectedAssistantInProject(null);
  }, [activeProject?.id]);

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
  const openFloatingFromUrl = searchParams.get("openFloating") === "1";
  const centralHasRid = isCentralAssistant && !!searchParams.get("rid");

  // App (tool) with domain_url: use iframe (e.g. Write after installing from zip)
  const appDomainUrl = (appToolWithDomain as { domainUrl?: string } | undefined)?.domainUrl ?? (assistant as { domainUrl?: string } | undefined)?.domainUrl;

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

  // App (tool) with domain_url: show app UI in iframe
  if (appDomainUrl) {
    const appName = (appToolWithDomain?.name ?? assistant?.name) ?? aliasParam;
    const iframeSrc = searchParams.toString() ? `${appDomainUrl.replace(/\/$/, "")}?${searchParams.toString()}` : appDomainUrl;
    const projectId = searchParams.get("rid")?.trim() || undefined;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <iframe
          title={appName}
          src={iframeSrc}
          className="w-full flex-1 min-h-0 border-0"
          allow="clipboard-read; clipboard-write"
        />
        <FloatingChatWidget
          alias={aliasParam}
          title={appName}
          defaultOpen={openFloatingFromUrl}
          projectId={projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? projectId : undefined}
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
