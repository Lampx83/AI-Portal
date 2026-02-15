"use client"

import { useState, useCallback, useEffect } from "react"
import { MessageCircle, RefreshCw, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getAgents, type AgentRow } from "@/lib/api/admin"

const DEFAULT_BASE_URL =
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
const DEFAULT_ALIAS = "central"

function getEmbedUrl(baseUrl: string, alias: string): string {
  const base = (baseUrl || "").replace(/\/+$/, "")
  const a = (alias || "central").trim() || "central"
  return base ? `${base}/embed/${encodeURIComponent(a)}` : ""
}

export function TestEmbedTab() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
  const [alias, setAlias] = useState(DEFAULT_ALIAS)
  const [mode, setMode] = useState<"fullscreen" | "floating">("fullscreen")
  const [embedSrc, setEmbedSrc] = useState(getEmbedUrl(DEFAULT_BASE_URL, DEFAULT_ALIAS))
  const [floatingOpen, setFloatingOpen] = useState(false)
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)

  useEffect(() => {
    getAgents()
      .then((r) => {
        const list = r.agents ?? []
        setAgents(list)
        if (list.length > 0 && !list.some((a) => a.alias === alias)) {
          setAlias(list[0].alias)
        }
      })
      .catch(() => setAgents([]))
      .finally(() => setAgentsLoading(false))
  }, [])

  const applyUrl = useCallback(() => {
    const url = getEmbedUrl(baseUrl, alias)
    setEmbedSrc(url || "about:blank")
  }, [baseUrl, alias])

  const handleKeyDown = (e: React.KeyboardEvent, fn: () => void) => {
    if (e.key === "Enter") fn()
  }

  const exampleBase = baseUrl || "https://your-domain.com"
  const exampleUrl = getEmbedUrl(exampleBase, alias)
  const exampleUrlWithParams = `${exampleUrl}?color=blue&icon=Bot`

  const embedGuideContent = (
    <div className="space-y-6 text-sm max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <h4 className="font-semibold text-foreground mb-2">Bước 1: Xác định URL gốc và Agent</h4>
        <ul className="list-decimal list-inside space-y-1.5 text-muted-foreground">
          <li><strong>URL gốc</strong>: Địa chỉ ứng dụng AI Portal (ví dụ: <code className="bg-muted px-1 rounded">https://portal.example.com</code> hoặc <code className="bg-muted px-1 rounded">http://localhost:3000</code>). Không thêm dấu <code className="bg-muted px-1 rounded">/</code> ở cuối.</li>
          <li><strong>Agent (alias)</strong>: Mã trợ lý bạn muốn nhúng. Xem danh sách trong tab <strong>Agents</strong> (cột Alias). Ví dụ: <code className="bg-muted px-1 rounded">central</code>, <code className="bg-muted px-1 rounded">regulations</code>, <code className="bg-muted px-1 rounded">data</code>.</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-2">Bước 2: Tạo URL nhúng</h4>
        <p className="text-muted-foreground mb-2">URL nhúng có dạng:</p>
        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all">
          {exampleBase}/embed/{alias || "central"}
        </pre>
        <p className="text-muted-foreground mt-2">Bạn có thể thêm tham số tùy chọn (query string):</p>
        <ul className="list-disc list-inside mt-1.5 text-muted-foreground space-y-0.5">
          <li><code className="bg-muted px-1 rounded">color</code> hoặc <code className="bg-muted px-1 rounded">theme</code>: Màu chủ đạo (blue, emerald, violet, amber, sky, indigo, rose, teal).</li>
          <li><code className="bg-muted px-1 rounded">icon</code>: Tên icon (Bot, MessageSquare, Brain, Users, Database, ListTodo, ShieldCheck, Award, Newspaper, FileText).</li>
        </ul>
        <p className="text-muted-foreground mt-2">Ví dụ URL đầy đủ:</p>
        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap break-all mt-1">
          {exampleUrlWithParams}
        </pre>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-2">Bước 3: Chọn cách nhúng</h4>
        <p className="text-muted-foreground mb-2">Có hai cách chính:</p>
        <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
          <li>
            <strong className="text-foreground">Nhúng toàn màn hình (iframe)</strong> — Widget chat chiếm toàn bộ vùng bạn cấp (ví dụ một khu vực trong trang).
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto mt-2">
{`<iframe
  src="${exampleUrl}"
  title="Trợ lý AI"
  width="100%"
  height="600"
  style="border: none; border-radius: 8px;"
></iframe>`}
            </pre>
          </li>
          <li>
            <strong className="text-foreground">Nhúng dạng Floating (nút chat góc dưới)</strong> — Trang của bạn hiển thị bình thường; khi người dùng bấm nút (góc dưới phải), mới mở cửa sổ chat.
            <p className="mt-2">Bạn cần tự thêm nút (button) và một cửa sổ/modal chứa iframe. Khi bấm nút, set <code className="bg-muted px-1 rounded">src</code> của iframe là URL nhúng ở Bước 2 và hiển thị cửa sổ. Có thể tham khảo giao diện trong chế độ &quot;Floating&quot; của ô Test phía dưới.</p>
          </li>
        </ol>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-2">Bước 4: Đặt iframe vào HTML</h4>
        <ul className="list-decimal list-inside space-y-1.5 text-muted-foreground">
          <li>Mở file HTML (hoặc template) của trang bạn muốn nhúng trợ lý.</li>
          <li>Chèn thẻ <code className="bg-muted px-1 rounded">&lt;iframe&gt;</code> vào vị trí mong muốn (trong body).</li>
          <li>Thay <code className="bg-muted px-1 rounded">src</code> bằng URL nhúng bạn đã tạo (Bước 2).</li>
          <li>Điều chỉnh <code className="bg-muted px-1 rounded">width</code>, <code className="bg-muted px-1 rounded">height</code> (hoặc CSS) cho phù hợp layout.</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-foreground mb-2">Bước 5: Kiểm tra và triển khai</h4>
        <ul className="list-decimal list-inside space-y-1.5 text-muted-foreground">
          <li>Lưu file và mở trang trong trình duyệt để kiểm tra.</li>
          <li>Đảm bảo domain của trang nhúng được phép (CORS / chính sách bảo mật của ứng dụng AI Portal nếu có).</li>
          <li>Khi triển khai lên production, thay URL gốc bằng địa chỉ production (ví dụ <code className="bg-muted px-1 rounded">https://your-domain.com</code>).</li>
        </ul>
      </div>

      <p className="text-muted-foreground border-t pt-4">
        Bạn có thể dùng ô <strong>Test Embed</strong> ngay bên dưới để xem trước: chọn URL, Agent, chế độ Toàn màn hình hoặc Floating rồi bấm <strong>Tải lại</strong>.
      </p>
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px] gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Test Embed AI Agent</CardTitle>
          <CardDescription>
            Xem trước widget nhúng trợ lý AI: chế độ Toàn màn hình (iframe) hoặc Floating (nút chat góc dưới).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "fullscreen" | "floating")}
            className="flex gap-2"
          >
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <RadioGroupItem value="fullscreen" id="mode-fullscreen" />
              <Label htmlFor="mode-fullscreen" className="cursor-pointer text-sm font-normal">
                Toàn màn hình
              </Label>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <RadioGroupItem value="floating" id="mode-floating" />
              <Label htmlFor="mode-floating" className="cursor-pointer text-sm font-normal">
                Floating
              </Label>
            </div>
          </RadioGroup>
          <div className="flex items-center gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="embed-url" className="text-xs">
                URL
              </Label>
              <Input
                id="embed-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, applyUrl)}
                placeholder="http://localhost:3000"
                className="w-[220px]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="embed-agent" className="text-xs">
                Agent
              </Label>
              <Select
                value={alias}
                onValueChange={setAlias}
                disabled={agentsLoading}
              >
                <SelectTrigger id="embed-agent" className="w-[180px]">
                  <SelectValue placeholder={agentsLoading ? "Đang tải…" : "Chọn agent"} />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 && !agentsLoading ? (
                    <SelectItem value="central">central (mặc định)</SelectItem>
                  ) : (
                    agents.map((a) => (
                      <SelectItem key={a.id} value={a.alias}>
                        {a.alias} {a.base_url ? `(${a.base_url})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <BookOpen className="h-4 w-4" />
                Hướng dẫn nhúng
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Hướng dẫn nhúng (Embed) Trợ lý AI
                </DialogTitle>
                <DialogDescription>
                  Step-by-step nhúng widget trợ lý AI vào website hoặc ứng dụng.
                </DialogDescription>
              </DialogHeader>
              {embedGuideContent}
            </DialogContent>
          </Dialog>
          <Button onClick={applyUrl} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tải lại
          </Button>
        </CardContent>
      </Card>

      {/* Fullscreen: iframe chiếm phần còn lại */}
      <div
        className={`flex-1 min-h-[300px] rounded-lg border bg-muted/30 overflow-hidden ${
          mode === "floating" ? "hidden" : "flex"
        }`}
      >
        <iframe
          key={embedSrc}
          src={embedSrc}
          title="Embed AI Agent"
          className="w-full h-full min-h-[300px] border-0"
        />
      </div>

      {/* Floating: placeholder + nút + cửa sổ */}
      <div
        className={`flex-1 min-h-[300px] rounded-lg border bg-muted/30 flex items-center justify-center text-muted-foreground ${
          mode === "fullscreen" ? "hidden" : "flex"
        }`}
      >
        <p className="text-sm">Trang mẫu – chế độ Floating. Nhấn icon góc dưới phải để mở chat.</p>
      </div>

      {/* Floating trigger - chỉ hiện khi mode floating */}
      {mode === "floating" && (
        <button
          type="button"
          onClick={() => setFloatingOpen((o) => !o)}
          className="fixed right-6 bottom-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center z-[9998]"
          title="Mở chat với Trợ lý AI"
          aria-label="Mở chat"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Floating window */}
      {mode === "floating" && floatingOpen && (
        <div className="fixed right-6 bottom-24 w-[380px] h-[520px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-120px)] bg-background rounded-xl shadow-xl border flex flex-col z-[9999] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
            <span className="font-semibold">Trợ lý AI</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-white/20"
              onClick={() => setFloatingOpen(false)}
              aria-label="Đóng"
            >
              ×
            </Button>
          </div>
          <iframe
            key={floatingOpen ? getEmbedUrl(baseUrl, alias) : "blank"}
            src={floatingOpen ? getEmbedUrl(baseUrl, alias) || "about:blank" : "about:blank"}
            title="Embed AI Agent - Floating"
            className="flex-1 w-full min-h-0 border-0"
          />
        </div>
      )}
    </div>
  )
}
