// app/assistants/[alias]/page.tsx
"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  useParams,
  useRouter,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link"
import {
  LayoutGrid,
  List,
  ChevronUp,
  ChevronDown,
  Pencil,
  FileText,
  BarChart3,
  X,
} from "lucide-react";
import {
  ChatInterface,
  ChatInterfaceHandle,
} from "@/components/chat-interface";
import { ChatSuggestions } from "@/components/chat-suggestions";
import { useAssistant, useAssistants } from "@/hooks/use-assistants";
import { MainAssistantView } from "@/components/assistants/main-assistant-view";
import { DataAssistantView } from "@/components/assistants/data-assistant-view";
import { FloatingChatWidget, isFloatingChatAlias } from "@/components/floating-chat-widget";
import { ProjectCenterView } from "@/components/project-center-view";
import { useActiveProject } from "@/contexts/active-project-context";
import { getProjectFileUrl } from "@/lib/api/projects";
import { getProjectIcon } from "@/lib/project-icons";
import { AssistantDataPane } from "@/components/assistant-data-pane";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_CONFIG } from "@/lib/config";
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage";
import { fetchChatSession, fetchChatSessions, createChatSession, GUEST_USER_ID } from "@/lib/chat";
import type { ChatSessionDTO } from "@/lib/chat";
import { getOrCreateGuestDeviceId, setGuestAlreadySentForAssistant } from "@/lib/guest-device-id";
const baseUrl = API_CONFIG.baseUrl;

// ───────────────────────────────────────────────────────────────
// Wrapper để thỏa yêu cầu: mọi component dùng useSearchParams phải ở trong Suspense
// ───────────────────────────────────────────────────────────────
export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Đang tải…</div>
      }
    >
      <AssistantPageImpl />
    </Suspense>
  );
}

function AssistantPageImpl() {
  const chatRef = useRef<ChatInterfaceHandle>(null);
  type UploadedFile = {
    name: string;
    url?: string;
    status: "uploading" | "done" | "error";
  };

  const params = useParams();
  const aliasParam = Array.isArray(params?.alias)
    ? params.alias[0]
    : params?.alias ?? "";
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sidEnsuredRef = useRef(false);
  useEffect(() => {
    sidEnsuredRef.current = false;
  }, [aliasParam]);

  useEffect(() => {
    if (sidEnsuredRef.current) return;
    const currentSid = searchParams.get("sid");
    if (currentSid) {
      setSessionId(currentSid);
      sidEnsuredRef.current = true;
      return;
    }
    const stored = getStoredSessionId(aliasParam);
    if (stored) {
      const sp = new URLSearchParams(searchParams?.toString() || "");
      sp.set("sid", stored);
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      setSessionId(stored);
      sidEnsuredRef.current = true;
      return;
    }
    const newSid = crypto.randomUUID();
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("sid", newSid);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    setSessionId(newSid);
    sidEnsuredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, aliasParam]); // đủ để tránh re-run không cần thiết

  const sid = searchParams.get("sid") || "";

  useEffect(() => {
    if (aliasParam && sid) setStoredSessionId(aliasParam, sid);
  }, [aliasParam, sid]);

  // Công cụ write và project tách riêng: /assistants/write dùng trang riêng; dự án làm việc với trợ lý central.

  // state UI ngoài ChatInterface
  const [hasMessages, setHasMessages] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Mặc định collapsed để hiển thị chat
  const [centralProjectHasMessages, setCentralProjectHasMessages] = useState(false);
  /** Trong dự án: trợ lý đang chọn để chat (hiển thị icon + tên trong ô chat), null = Trợ lý chính */
  const [selectedAssistantInProject, setSelectedAssistantInProject] = useState<{ alias: string; name: string; icon?: string } | null>(null);

  const [dataAnalyses, setDataAnalyses] = useState<ChatSessionDTO[]>([]);
  const [dataAnalysesLoading, setDataAnalysesLoading] = useState(false);
  const [selectedDataAnalysisId, setSelectedDataAnalysisId] = useState<string | null>(null);

  // 👉 Reset UI “ngoài” khi đổi sid hoặc người dùng bấm Trò chuyện mới
  useEffect(() => {
    if (!sid) return;
    // về trạng thái ban đầu như lúc mới vào trang: mặc định hiển thị chat (collapsed)
    setHasMessages(false);
    setIsCollapsed(true); // Mặc định collapsed để hiển thị chat
    setCentralProjectHasMessages(false);
    // nếu bạn có thêm state khác ở ngoài ChatInterface (ví dụ cache items), cân nhắc reset tiếp ở đây
  }, [sid]);

  // Quản lý sessionId lấy từ URL (nếu đã có) hoặc tạo sau
  const [sessionId, setSessionId] = useState<string>(
    searchParams.get("sid") || ""
  );

  // Hàm chỉ tạo + đẩy sid lên URL khi cần
  const ensureSessionId = () => {
    if (searchParams.get("sid")) return searchParams.get("sid");
    const newSid = crypto.randomUUID();
    setSessionId(newSid);

    // Giữ lại các query khác, chỉ thêm sid
    const sp = new URLSearchParams(searchParams?.toString() || "");
    sp.set("sid", newSid);

    // Không thay đổi hash; Next.js router.replace với chuỗi sẽ giữ nguyên history “nhẹ”
    router.replace(`${pathname}?${sp.toString()}`);
    return newSid;
  };

  const { assistant, loading: assistantLoading } = useAssistant(aliasParam || null);
  const { assistants: allAssistants } = useAssistants();
  const { activeProject, setActiveProject } = useActiveProject();

  // Danh sách trợ lý để chọn trong dự án (không gồm Trợ lý chính — mặc định không chọn = trợ lý chính)
  const chatAssistantsForProject = useMemo(() => {
    return allAssistants
      .filter((a) => !["central", "main", "write", "data"].includes(a.alias) && a.health === "healthy")
      .map((a) => ({ alias: a.alias, name: a.name ?? a.alias, icon: a.icon }))
  }, [allAssistants]);

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
    fetchChatSessions({
      projectId: rid,
      assistantAlias: "data",
      limit: 50,
      offset: 0,
    })
      .then((res) => {
        if (!cancelled) setDataAnalyses(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDataAnalyses([]);
      })
      .finally(() => {
        if (!cancelled) setDataAnalysesLoading(false);
      });
    return () => { cancelled = true; };
  }, [aliasParam, searchParams]);

  // ⚠️ QUAN TRỌNG: useSession() phải được gọi TRƯỚC mọi early return để tuân thủ Rules of Hooks
  const { data: session } = useSession();

  // Đã đăng nhập: chỉ dùng sid sau khi xác nhận không phải session khách, tránh hiển thị tin nhắn khách
  const [verifiedSid, setVerifiedSid] = useState<string | null>(null);
  useEffect(() => {
    setVerifiedSid(null);
  }, [sid]);
  useEffect(() => {
    if (!sid || !session?.user?.email) {
      if (!session?.user) setVerifiedSid(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchChatSession(sid);
        if (cancelled || !s) {
          if (!cancelled) setVerifiedSid(sid);
          return;
        }
        if (String(s.user_id) === GUEST_USER_ID) {
          const newSession = await createChatSession({
            user_id: session.user.email,
            project_id: activeProject?.id ?? null,
          });
          if (cancelled || !newSession?.id) return;
          setStoredSessionId(aliasParam, newSession.id);
          const sp = new URLSearchParams(searchParams?.toString() || "");
          sp.set("sid", newSession.id);
          router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
          setSessionId(newSession.id);
          if (!cancelled) setVerifiedSid(newSession.id);
        } else {
          if (!cancelled) setVerifiedSid(sid);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("Replace guest session failed:", e);
          setVerifiedSid(sid);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [sid, session?.user?.email, aliasParam, pathname, searchParams, router, activeProject?.id]);

  const dataTypes = useMemo(
    () =>
      (assistant?.provided_data_types ?? []).map((d: any) => ({
        type: d.type,
        label: d.label ?? d.type,
      })),
    [assistant?.alias]
  );

  // Tối đa 4 sample prompts, chọn ngẫu nhiên khi có nhiều hơn 4
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

  const [activeType, setActiveType] = useState<string>(
    dataTypes?.[0]?.type ?? ""
  );
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const [isLoading, setIsLoading] = useState(true);

  const [itemsByType, setItemsByType] = useState<Record<string, any[]>>({});
  const [loadingByType, setLoadingByType] = useState<Record<string, boolean>>(
    {}
  );

  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    if (!assistant) return;
    setItemsByType({});
    setLoadingByType({});
    setActiveType(dataTypes?.[0]?.type ?? "");
    setIsLoading(true);
    // Reset về trạng thái mặc định: hiển thị chat (collapsed)
    setIsCollapsed(true);
    setHasMessages(false);

    if (assistant?.supported_models?.length) {
      setSelectedModelId(assistant.supported_models[0].model_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant?.alias]);

  useEffect(() => {
    if (!assistant || !activeType) {
      setIsLoading(false);
      return;
    }
    if (itemsByType[activeType]) {
      setIsLoading(false);
      return;
    }

    const run = async () => {
      setIsLoading(true);
      setLoadingByType((m) => ({ ...m, [activeType]: true }));
      try {
        // Nếu có domainUrl, đó là backend proxy endpoint - cần convert sang đúng backend URL
        // Nếu không có domainUrl, dùng baseUrl và thử cả /data và /v1/data
        let urls: string[] = [];
        
        if (assistant.domainUrl) {
          // domainUrl có thể là absolute URL (production) hoặc relative path
          // Trong development, convert production URL sang localhost backend URL
          let proxyUrl = assistant.domainUrl;
          
          if (proxyUrl.startsWith('/')) {
            // Relative path - thêm backend base URL
            proxyUrl = `${baseUrl}${proxyUrl}`;
          } else if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
            // Absolute URL - trong development, convert production domain sang localhost
            if (process.env.NODE_ENV === "development" && proxyUrl.includes("portal.neu.edu.vn")) {
              // Extract path từ production URL và dùng localhost backend
              try {
                const urlObj = new URL(proxyUrl);
                proxyUrl = `${baseUrl}${urlObj.pathname}`;
              } catch (e) {
                // Nếu parse URL lỗi, fallback về dùng baseUrl + extract path manually
                const pathMatch = proxyUrl.match(/https?:\/\/[^\/]+(\/.*)/);
                if (pathMatch) {
                  proxyUrl = `${baseUrl}${pathMatch[1]}`;
                }
              }
            }
            // Nếu không phải development hoặc không phải production domain, dùng trực tiếp
          } else {
            // Không có protocol - thêm backend base URL
            proxyUrl = `${baseUrl}/${proxyUrl}`;
          }
          // Backend proxy endpoint nhận query params và tự động proxy đến agent /data
          urls = [`${proxyUrl}?type=${encodeURIComponent(activeType)}`];
        } else {
          // Dùng baseUrl và thử cả /data và /v1/data
          urls = [
            `${assistant.baseUrl}/data?type=${encodeURIComponent(activeType)}`,
            `${assistant.baseUrl}/v1/data?type=${encodeURIComponent(activeType)}`
          ];
        }

        let success = false;

        for (const testUrl of urls) {
          try {
            const res = await fetch(testUrl);
            if (!res.ok) {
              console.warn(`Data endpoint returned ${res.status}: ${testUrl}`);
              continue;
            }
            const json = await res.json();
            const items = Array.isArray(json?.items) ? json.items : [];
            setItemsByType((m) => ({ ...m, [activeType]: items }));
            success = true;
            break;
          } catch (e: any) {
            console.warn(`Failed to fetch from ${testUrl}:`, e?.message ?? e);
          }
        }

        if (!success) {
          setItemsByType((m) => ({ ...m, [activeType]: [] }));
        }
      } catch (e) {
        console.error("Error fetching data:", e);
        setItemsByType((m) => ({ ...m, [activeType]: [] }));
      } finally {
        setIsLoading(false);
        setLoadingByType((m) => ({ ...m, [activeType]: false }));
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistant?.baseUrl, activeType]);

  const toggleCollapse = () => setIsCollapsed((p) => !p);

  const isCentralAssistant = aliasParam === "central";
  const isWriteAssistant = aliasParam === "write";
  const isDataAssistant = aliasParam === "data";

  const openFloatingFromUrl = searchParams.get("openFloating") === "1"
  const centralHasRid = isCentralAssistant && !!searchParams.get("rid")
  // Trợ lý chính (central): có rid → UI theo dự án; không có rid → ô chat bình thường như trợ lý khác (không dùng write/editor).
  if (isCentralAssistant) {
    if (centralHasRid && !activeProject) {
      return (
        <div className="flex h-full min-h-0 flex-col items-center justify-center text-muted-foreground">
          <p className="text-sm">Đang tải dự án…</p>
        </div>
      )
    }
    if (activeProject) {
      const projectName = activeProject.name?.trim() || "Dự án";
      const projectIcon = (activeProject.icon?.trim() || "FolderKanban") as string;
      const ProjectIconComp = getProjectIcon(projectIcon);
      const openEditProject = () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("open-edit-project", { detail: activeProject }));
        }
      };

      const chatCommon = {
        onFileUploaded: (f: UploadedFile & { url?: string }) =>
          setUploadedFiles((prev) => [...prev, { ...f, status: "done" }]),
        uploadedFiles: uploadedFiles
          .filter((f): f is UploadedFile & { url: string } => !!f.url)
          .map((f) => ({ name: f.name, url: f.url, status: f.status })),
        onClearUploadedFiles: () => setUploadedFiles([]),
        onSendMessage: async (prompt: string | null, modelId: string, signal: AbortSignal) => {
          const trimmed = (prompt ?? "").replace(/\s+/g, " ").trim();
          const sessionTitle = trimmed ? trimmed.slice(0, 60) : "File đính kèm";
          const currentSid = ensureSessionId();
          const uploadedDocs = uploadedFiles.map((f) => ({ url: f.url!, name: f.name }));
          const projectDocs = (activeProject?.file_keys ?? []).map((key) => ({
            url: getProjectFileUrl(key),
            name: key.split("/").pop() || key,
          }));
          const documentList = [...uploadedDocs, ...projectDocs];
          setUploadedFiles([]);
          const backendUrl = API_CONFIG.baseUrl;
          const requestBody = {
            assistant_base_url: assistant?.baseUrl,
            assistant_alias: "central",
            session_title: sessionTitle,
            user_id: session?.user?.email ?? null,
            ...(session?.user ? {} : { guest_device_id: getOrCreateGuestDeviceId() }),
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
            const res = await fetch(`${backendUrl}/api/chat/sessions/${currentSid}/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal,
            });
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
              if (!session?.user) setGuestAlreadySentForAssistant("central");
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
                  ? "Không thể kết nối đến backend. Kiểm tra backend có đang chạy không."
                  : "Lỗi kết nối mạng: " + err.message;
              throw new Error(message);
            }
            throw err;
          }
        },
        models: (assistant?.supported_models || []).map((m: any) => ({ model_id: m.model_id, name: m.name })),
      };

      const projectRid = activeProject?.id != null ? String(activeProject.id) : ""
      const projectBaseQuery = projectRid ? `?rid=${encodeURIComponent(projectRid)}` : ""

      if (centralProjectHasMessages) {
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex-shrink-0 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 px-4 py-2">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 shrink-0">
                <ProjectIconComp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                <Link href={`/assistants/write${projectBaseQuery}`} title="Bài viết">
                  <FileText className="h-3.5 w-3.5" />
                </Link>
              </Button>
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
                key={(session?.user ? verifiedSid : sid) || "no-sid"}
                ref={chatRef}
                className="h-full min-h-0 flex flex-col"
                assistantName={assistant?.name ?? "Trợ lý chính"}
                assistantAlias="central"
                projectContext={activeProject}
                sessionId={session?.user ? (verifiedSid ?? undefined) : (sid || undefined)}
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
              key={(session?.user ? verifiedSid : sid) || "no-sid"}
              ref={chatRef}
              className="flex flex-col"
              assistantName={assistant?.name ?? "Trợ lý chính"}
              assistantAlias="central"
              projectContext={activeProject}
              sessionId={session?.user ? (verifiedSid ?? undefined) : (sid || undefined)}
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
    // Central không có dự án (rid): dùng ô chat bình thường như các trợ lý khác (fall through bên dưới)
  }
  // Công cụ Viết bài (write): giao diện soạn thảo + chat riêng cho write
  if (isWriteAssistant) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <MainAssistantView />
        <FloatingChatWidget alias="write" title={assistant?.name ?? "Viết bài"} defaultOpen={openFloatingFromUrl} />
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
                <SelectItem value="__new__" className="text-xs">Phân tích mới</SelectItem>
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
        <DataAssistantView
          projectFiles={
            hasDataProject && activeProject && String(activeProject.id) === dataProjectId && (activeProject.file_keys?.length ?? 0) > 0
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
          sessionId={hasDataProject ? (selectedDataAnalysisId ?? null) : undefined}
        />
      </div>
    );
  }

  if (assistantLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Đang tải thông tin trợ lý...</div>
    );
  }

  if (!assistant) {
    return (
      <div className="p-6">
        Không tìm thấy trợ lý với alias: <b>{String(aliasParam)}</b>
      </div>
    );
  }

  const itemsCurrent = itemsByType[activeType] ?? [];
  const isOrchestrator = assistant?.alias === "central";
  const greetingName = session?.user?.name || session?.user?.email || "bạn";

  const headerTitle = isOrchestrator
    ? `Xin chào, ${greetingName} 👋`
    : assistant.name;
  const headerSubtitle = isOrchestrator
    ? "Bạn đã sẵn sàng khám phá chưa?"
    : assistant.description || "";

  const shouldShowSuggestions =
    !!assistant?.sample_prompts?.length &&
    !hasMessages &&
    (isOrchestrator || isCollapsed || !activeType);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <>
          {/* Header: Chỉ hiển thị với trợ lý khác central (trợ lý chính). */}
          {!isOrchestrator && (
          <div className="flex justify-between items-center h-14 px-4 bg-gray-50 dark:bg-gray-900/50 border-b flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {assistant.Icon && <assistant.Icon className="h-5 w-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {assistant.name}
              </span>
            </div>
            {!isOrchestrator && (
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
              <Button
                variant="outline"
                size="sm"
                className="h-8 cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleCollapse();
                }}
              >
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
            )}
          </div>
          )}

          {/* Data Pane: Chỉ với trợ lý không phải central (orchestrator). Trợ lý chính không có Data pane. */}
          {!isOrchestrator && !isCollapsed && (
            <div className="flex-1 min-h-0 transition-all duration-300 overflow-auto">
              <div className="h-full p-4 sm:p-6 lg:p-8">
                <div className="flex h-full w-full max-w-none flex-col min-h-0">
                  <div className="mb-4">
                    <h1 className="text-2xl font-bold">{headerTitle}</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      {headerSubtitle}
                    </p>
                  </div>

                  {dataTypes.length > 1 ? (
                    <Tabs
                      value={activeType}
                      onValueChange={setActiveType}
                      className="flex-1 min-h-0 flex flex-col"
                    >
                      <TabsList className="mb-4 w-full overflow-auto">
                        {dataTypes.map((dt) => (
                          <TabsTrigger
                            key={dt.type}
                            value={dt.type}
                            className="whitespace-nowrap"
                          >
                            {dt.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {dataTypes.map((dt) => (
                        <TabsContent
                          key={dt.type}
                          value={dt.type}
                          className="flex-1 min-h-0"
                        >
                          <AssistantDataPane
                            items={
                              dt.type === activeType
                                ? itemsCurrent
                                : itemsByType[dt.type] ?? []
                            }
                            isLoading={
                              dt.type === activeType
                                ? isLoading || !!loadingByType[dt.type]
                                : !!loadingByType[dt.type]
                            }
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

          {/* Suggestions: hiển thị giữa màn hình khi không có messages và collapsed */}
          {shouldShowSuggestions && (
            <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-4">
              <ChatSuggestions
                suggestions={sampleSuggestions}
                onSuggestionClick={(s) => {
                  chatRef.current?.applySuggestion(s);
                }}
                assistantName={assistant.name || ""}
              />
            </div>
          )}
        </>

      {/* Chat: Floating cho data/review, inline cho các agent khác */}
      {isFloatingChatAlias(aliasParam) && (
        <FloatingChatWidget alias={aliasParam} title={assistant.name} />
      )}
      {(isCollapsed || isOrchestrator) && !isFloatingChatAlias(aliasParam) && (
        <div
          className={
            shouldShowSuggestions
              ? "flex-shrink-0 min-h-[120px] flex flex-col overflow-hidden"
              : "flex-1 min-h-0 flex flex-col overflow-hidden"
          }
        >
        <ChatInterface
          key={(session?.user ? verifiedSid : sid) || "no-sid"}
          ref={chatRef}
          className={"h-full min-h-0 flex flex-col bg-background"}
          assistantName={assistant.name}
          assistantAlias={assistant.alias}
          projectContext={activeProject ?? null}
          sessionId={session?.user ? (verifiedSid ?? undefined) : (sid || undefined)}
          onMessagesChange={(count) => {
            const has = count > 0;
            const wasEmpty = !hasMessages;
            setHasMessages(has);
            // Chỉ tự động collapse khi chuyển từ không có messages sang có messages lần đầu
            // Giữ nguyên trạng thái nếu người dùng đã expand ra sau đó
            if (has && wasEmpty) {
              setIsCollapsed(true);
            }
          }}
          onChatStart={() => {
            // Tạo + đẩy sid lên URL ngay khoảnh khắc bắt đầu chat
            ensureSessionId();
            setIsCollapsed(true);
            setHasMessages(true);
          }}
        onFileUploaded={(f) =>
          setUploadedFiles((prev) => [...prev, { ...f, status: "done" }])
        }
        uploadedFiles={uploadedFiles
          .filter((f): f is UploadedFile & { url: string } => !!f.url)
          .map((f) => ({ name: f.name, url: f.url, status: f.status }))}
        onClearUploadedFiles={() => setUploadedFiles([])}
        onSendMessage={async (prompt, modelId, signal) => {
          const trimmed = (prompt ?? "").replace(/\s+/g, " ").trim();
          const sessionTitle = trimmed
            ? trimmed.slice(0, 60)
            : "File đính kèm";
          const sid = ensureSessionId();
          // Lấy danh sách file (URL + tên gốc) từ uploadedFiles để gửi kèm trong context
          const uploadedDocs = uploadedFiles.map((f) => ({ url: f.url, name: f.name }));
          // Thêm file của dự án (nếu có) để agent có thể đọc nội dung
          const projectDocs = (activeProject?.file_keys ?? []).map((key) => ({
            url: getProjectFileUrl(key),
            name: key.split("/").pop() || key,
          }));
          const documentList = [...uploadedDocs, ...projectDocs];

          // Clear uploaded files sau khi đã gửi
          setUploadedFiles([]);

          // Use backend API URL from config.ts
          const backendUrl = API_CONFIG.baseUrl;

          const requestBody = {
            assistant_base_url: assistant.baseUrl,
            assistant_alias: assistant.alias,
            session_title: sessionTitle,
            user_id: session?.user?.email ?? null,
            ...(session?.user ? {} : { guest_device_id: getOrCreateGuestDeviceId() }),
            model_id: modelId,
            prompt,
            user: "demo-user",
            project_id: activeProject?.id ?? null,
            context: {
              language: "vi",
              project: activeProject?.name ?? "demo-project",
              project_id: activeProject?.id ?? null,
              extra_data: {
                document: documentList,
              },
            },
          };

          try {
            const res = await fetch(`${backendUrl}/api/chat/sessions/${sid}/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
              signal,
            });

            if (!res.ok) {
              let errorText = '';
              try {
                errorText = await res.text();
              } catch (e) {
                console.error("❌ Failed to read error response:", e);
              }
              
              console.error("❌ Backend error response:", {
                status: res.status,
                statusText: res.statusText,
                errorText: errorText || '(empty)',
                url: `${backendUrl}/api/chat/sessions/${sid}/send`,
                backendUrl,
              })
              
              let errorMessage = `HTTP ${res.status}: ${res.statusText || 'Unknown error'}`;
              if (errorText) {
                try {
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson?.message || errorJson?.error || errorMessage;
                } catch {
                  // If not JSON, use the text as error message
                  errorMessage = errorText || errorMessage;
                }
              }
              
              // Provide more specific error messages
              if (res.status === 0 || res.status === 503) {
                errorMessage = 'Backend server không khả dụng. Vui lòng kiểm tra backend có đang chạy không.';
              } else if (res.status === 502) {
                errorMessage = 'Lỗi kết nối đến AI agent. ' + errorMessage;
              } else if (res.status === 400) {
                errorMessage = 'Yêu cầu không hợp lệ. ' + errorMessage;
              }
              if (res.status === 429 && typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("refresh-quota"));
              }
              throw new Error(errorMessage);
            }
            
            let json;
            try {
              const responseText = await res.text();
              json = JSON.parse(responseText);
            } catch (e) {
              console.error("❌ Failed to parse response as JSON:", e);
              throw new Error('Backend trả về response không hợp lệ');
            }
            
            if (json?.status === "success") {
              if (!session?.user) setGuestAlreadySentForAssistant(assistant.alias);
              const content = json.content_markdown || "";
              if (!content) {
                console.warn("⚠️ Response has status 'success' but empty content_markdown")
              }
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("refresh-quota"));
              }
              // Trigger reload sidebar để cập nhật số lượng tin nhắn
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('chat-message-sent', { detail: { sessionId: sid } }));
              }
              const agents = json?.meta?.agents;
              const messageId = json.assistant_message_id ?? undefined;
              if (agents?.length || messageId) {
                return { content, ...(agents?.length ? { meta: { agents } } : {}), ...(messageId ? { messageId } : {}) };
              }
              return content;
            }
            throw new Error(json?.error || "Send failed");
          } catch (err: any) {
            // Handle network errors (e.g., "Failed to fetch", CORS, etc.)
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
              const message = err.message.includes('Failed to fetch') || err.message.includes('NetworkError')
                ? `Không thể kết nối đến backend tại ${backendUrl}. Vui lòng kiểm tra:\n1. Backend có đang chạy không?\n2. URL backend có đúng không?\n3. CORS có được cấu hình đúng không?`
                : 'Lỗi kết nối mạng: ' + err.message;
              throw new Error(message);
            }
            // Re-throw other errors as-is
            throw err;
          }
        }}
        models={(assistant.supported_models || []).map((m: any) => ({
          model_id: m.model_id,
          name: m.name,
        }))}
        />
        </div>
      )}
    </div>
  );
}
