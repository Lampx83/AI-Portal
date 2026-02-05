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
import {
  LayoutGrid,
  List,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  ChatInterface,
  ChatInterfaceHandle,
} from "@/components/chat-interface";
import { ChatSuggestions } from "@/components/chat-suggestions";
import { useResearchAssistant } from "@/hooks/use-research-assistants";
import { MainAssistantView } from "@/components/assistants/main-assistant-view";
import { DataAssistantView } from "@/components/assistants/data-assistant-view";
import { FloatingChatWidget, isFloatingChatAlias } from "@/components/floating-chat-widget";
import { useActiveResearch } from "@/contexts/active-research-context";
import { getResearchProjectFileUrl } from "@/lib/api/research-projects";
import { AssistantDataPane } from "@/components/assistant-data-pane";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { API_CONFIG } from "@/lib/config";
import { getStoredSessionId, setStoredSessionId } from "@/lib/assistant-session-storage";
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

  // Gom write vào main: chuyển /assistants/write → /assistants/main
  useEffect(() => {
    if (aliasParam !== "write") return;
    const sp = new URLSearchParams(searchParams?.toString() || "");
    router.replace(`/assistants/main?${sp.toString()}`, { scroll: false });
  }, [aliasParam, router, searchParams]);

  // state UI ngoài ChatInterface
  const [hasMessages, setHasMessages] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true); // Mặc định collapsed để hiển thị chat

  // 👉 Reset UI “ngoài” khi đổi sid hoặc người dùng bấm Trò chuyện mới
  useEffect(() => {
    if (!sid) return;
    // về trạng thái ban đầu như lúc mới vào trang: mặc định hiển thị chat (collapsed)
    setHasMessages(false);
    setIsCollapsed(true); // Mặc định collapsed để hiển thị chat
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

  const { assistant, loading: assistantLoading } = useResearchAssistant(aliasParam || null);
  const { activeResearch } = useActiveResearch();

  // ⚠️ QUAN TRỌNG: useSession() phải được gọi TRƯỚC mọi early return để tuân thủ Rules of Hooks
  const { data: session } = useSession();

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
            if (process.env.NODE_ENV === "development" && proxyUrl.includes('research.neu.edu.vn')) {
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

        let lastError: Error | null = null;
        let success = false;
        
        for (const testUrl of urls) {
          try {
            const res = await fetch(testUrl);
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            const json = await res.json();
            const items = Array.isArray(json?.items) ? json.items : [];
            setItemsByType((m) => ({ ...m, [activeType]: items }));
            success = true;
            break;
          } catch (e: any) {
            lastError = e;
            console.warn(`Failed to fetch from ${testUrl}:`, e.message);
          }
        }
        
        if (!success && lastError) {
          throw lastError;
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

  const isMainAssistant = aliasParam === "main";
  const isWriteAssistant = aliasParam === "write";
  const isDataAssistant = aliasParam === "data";

  const openFloatingFromUrl = searchParams.get("openFloating") === "1"
  // Trợ lý chính (main): giao diện chính = soạn thảo, chat điều phối = floating
  if (isMainAssistant) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <MainAssistantView />
        <FloatingChatWidget alias="main" title="Trợ lý chính" defaultOpen={openFloatingFromUrl} />
      </div>
    );
  }
  // /write → cùng giao diện Trợ lý chính (redirect trong useEffect)
  if (isWriteAssistant) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <MainAssistantView />
        <FloatingChatWidget alias="main" title="Trợ lý chính" defaultOpen={openFloatingFromUrl} />
      </div>
    );
  }
  if (isDataAssistant) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <DataAssistantView />
        <FloatingChatWidget alias="data" title="Trợ lý Dữ liệu" />
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
  const isOrchestrator = assistant?.alias === "main";
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
    <div className="flex h-full min-h-0 flex-col">
        <>
          {/* Header: Chỉ hiển thị với trợ lý khác Main. Main không có header này. */}
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

          {/* Data Pane: Chỉ với trợ lý không phải main (orchestrator). Main không có Data pane. */}
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

          {/* Suggestions: Hiển thị khi không có messages và collapsed */}
          {shouldShowSuggestions && (
            <div className="flex-1 min-h-0 overflow-auto p-4 ">
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
        <ChatInterface
          key={sid || "no-sid"}
          ref={chatRef}
          className="flex-1 min-h-0  bg-background"
          assistantName={assistant.name}
          researchContext={activeResearch ?? null}
          sessionId={sid || undefined}
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
          // Thêm file của nghiên cứu (nếu có) để agent có thể đọc nội dung
          const researchDocs = (activeResearch?.file_keys ?? []).map((key) => ({
            url: getResearchProjectFileUrl(key),
            name: key.split("/").pop() || key,
          }));
          const documentList = [...uploadedDocs, ...researchDocs];

          // Clear uploaded files sau khi đã gửi
          setUploadedFiles([]);

          // Use backend API URL from config.ts
          const backendUrl = API_CONFIG.baseUrl;

          const requestBody = {
            assistant_base_url: assistant.baseUrl,
            assistant_alias: assistant.alias,
            session_title: sessionTitle,
            user_id: session?.user?.email ?? null,
            model_id: modelId,
            prompt,
            user: "demo-user",
            research_id: activeResearch?.id ?? null,
            context: {
              language: "vi",
              project: activeResearch?.name ?? "demo-project",
              research_id: activeResearch?.id ?? null,
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
              const agents = json?.meta?.agents
              if (agents?.length) {
                return { content, meta: { agents } }
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
      )}
    </div>
  );
}
