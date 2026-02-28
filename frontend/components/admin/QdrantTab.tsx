"use client"

import { useEffect, useState, useCallback, Fragment } from "react"
import { Database, RefreshCw, ChevronRight, Server, CheckCircle, XCircle, Search, List, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getAppSettings,
  patchAppSettings,
  getQdrantHealth,
  getQdrantCollections,
  getQdrantCollection,
  searchQdrantVectors,
  scrollQdrantCollection,
  type QdrantHealth as QdrantHealthType,
  type QdrantCollectionInfo,
  type QdrantSearchPoint,
  type QdrantScrollPoint,
} from "@/lib/api/admin"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { Save } from "lucide-react"

function getPayloadText(payload: Record<string, unknown>): string {
  for (const k of ["text", "content", "body", "paragraph", "chunk"]) {
    const v = payload[k]
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200)
  }
  for (const v of Object.values(payload)) {
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200)
  }
  return JSON.stringify(payload).slice(0, 200)
}

export function QdrantTab() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [health, setHealth] = useState<QdrantHealthType | null>(null)
  const [collections, setCollections] = useState<string[]>([])
  const [collectionDetails, setCollectionDetails] = useState<Record<string, QdrantCollectionInfo>>({})
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [urlFromCollections, setUrlFromCollections] = useState<string | null>(null)

  // Vector search by keyword
  const [searchCollection, setSearchCollection] = useState<string>("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [searchResults, setSearchResults] = useState<QdrantSearchPoint[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchExpanded, setSearchExpanded] = useState<string | null>(null)

  // Browse points (scroll)
  const [scrollCollection, setScrollCollection] = useState<string>("")
  const [scrollPoints, setScrollPoints] = useState<QdrantScrollPoint[]>([])
  const [scrollNextOffset, setScrollNextOffset] = useState<string | number | null>(null)
  const [scrollLoading, setScrollLoading] = useState(false)
  const [scrollExpanded, setScrollExpanded] = useState<string | number | null>(null)

  // Qdrant URL from Settings
  const [settingsQdrantUrl, setSettingsQdrantUrl] = useState("")
  const [savingQdrantUrl, setSavingQdrantUrl] = useState(false)

  const loadHealth = useCallback(() => {
    setLoadingHealth(true)
    getQdrantHealth()
      .then(setHealth)
      .catch((e) => {
        setHealth({ ok: false, status: 0, url: "", title: null, version: null, error: (e as Error)?.message })
        toast({ title: "Lỗi Qdrant", description: (e as Error)?.message, variant: "destructive" })
      })
      .finally(() => setLoadingHealth(false))
  }, [toast])

  const loadCollections = useCallback(() => {
    setLoadingCollections(true)
    getQdrantCollections()
      .then((d) => {
        setCollections(d.collections ?? [])
        if (d.url) setUrlFromCollections(d.url)
      })
      .catch((e) => {
        setCollections([])
        toast({ title: "Lỗi danh sách collections", description: (e as Error)?.message, variant: "destructive" })
      })
      .finally(() => setLoadingCollections(false))
  }, [])

  const loadCollectionDetail = useCallback((name: string) => {
    setLoadingDetail(name)
    getQdrantCollection(name)
      .then((info) => {
        setCollectionDetails((prev) => ({ ...prev, [name]: info }))
        setSelectedCollection(name)
      })
      .catch((e) => {
        toast({ title: `Lỗi collection ${name}`, description: (e as Error)?.message, variant: "destructive" })
      })
      .finally(() => setLoadingDetail(null))
  }, [toast])

  const refreshAll = () => {
    loadHealth()
    loadCollections()
    setSelectedCollection(null)
    setCollectionDetails({})
  }

  const handleSearch = async () => {
    const col = searchCollection.trim()
    const kw = searchKeyword.trim()
    if (!col || !kw) {
      toast({
        title: "Chọn collection và nhập từ khóa",
        description: "Cần chọn collection trong danh sách và gõ từ khóa trước khi tìm kiếm.",
        variant: "destructive",
      })
      return
    }
    setSearchLoading(true)
    setSearchResults(null)
    try {
      const data = await searchQdrantVectors({ collection: col, keyword: kw, limit: 20 })
      setSearchResults(data.points)
      toast({ title: "Đã tìm thấy", description: `${data.points.length} vector phù hợp` })
    } catch (e) {
      const msg = (e as Error)?.message ?? "Không kết nối được API. Kiểm tra OPENAI_API_KEY hoặc REGULATIONS_EMBEDDING_URL."
      toast({ title: "Lỗi tìm kiếm", description: msg, variant: "destructive" })
    } finally {
      setSearchLoading(false)
    }
  }

  const handleScrollLoad = async (offset?: string | number | null) => {
    const col = scrollCollection.trim()
    if (!col) {
      toast({ title: "Lỗi", description: "Chọn collection trước", variant: "destructive" })
      return
    }
    setScrollLoading(true)
    try {
      const data = await scrollQdrantCollection(col, { limit: 20, offset: offset ?? undefined })
      if (offset == null) {
        setScrollPoints(data.points)
      } else {
        setScrollPoints((prev) => [...prev, ...data.points])
      }
      setScrollNextOffset(data.next_page_offset)
    } catch (e) {
      toast({ title: "Lỗi duyệt points", description: (e as Error)?.message, variant: "destructive" })
    } finally {
      setScrollLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
    loadCollections()
  }, [loadHealth, loadCollections])

  useEffect(() => {
    getAppSettings().then((s) => setSettingsQdrantUrl(s?.qdrant_url ?? "")).catch(() => {})
  }, [])

  const qdrantUrl =
    health?.url ?? urlFromCollections ?? settingsQdrantUrl ?? process.env.NEXT_PUBLIC_QDRANT_URL ?? ""
  const isHealthy = health?.ok === true

  const saveQdrantUrl = () => {
    setSavingQdrantUrl(true)
    patchAppSettings({ qdrant_url: settingsQdrantUrl.trim() })
      .then(() => {
        toast({ title: t("admin.qdrant.savedUrl") })
        loadHealth()
        loadCollections()
      })
      .catch((e) => toast({ title: t("common.saveError"), description: (e as Error)?.message, variant: "destructive" }))
      .finally(() => setSavingQdrantUrl(false))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" />
          {t("admin.qdrant.title")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("admin.qdrant.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("admin.qdrant.urlCardTitle")}</CardTitle>
          <CardDescription>{t("admin.qdrant.urlCardDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input
                value={settingsQdrantUrl}
                onChange={(e) => setSettingsQdrantUrl(e.target.value)}
                placeholder={t("admin.settings.qdrantUrlPlaceholder")}
                className="font-mono text-sm"
                disabled={savingQdrantUrl}
              />
            </div>
            <Button onClick={saveQdrantUrl} disabled={savingQdrantUrl} size="sm" className="gap-1.5">
              <Save className="h-4 w-4" />
              {savingQdrantUrl ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              {t("admin.qdrant.connectionTitle")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <BookOpen className="h-4 w-4" />
                    {t("admin.qdrant.guideButton")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Hướng dẫn kết nối Qdrant (đầy đủ)
                    </DialogTitle>
                    <DialogDescription>
                      Dùng cho backend, agent, hoặc hệ thống bên ngoài cần đọc/ghi vector. API chi tiết: <a href="https://api.qdrant.tech/api-reference/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Qdrant API Reference</a>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 text-sm">
                    {/* Current URL (from backend) */}
                    <div>
                      <span className="font-medium text-foreground">URL Qdrant (từ backend dự án)</span>
                      <p className="text-muted-foreground mt-1 break-all"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{qdrantUrl}</code></p>
                      <p className="text-muted-foreground text-xs mt-0.5">REST: cổng 8010 · gRPC: cổng 6334 (nếu bật). Phiên bản: {health?.version ?? "—"}</p>
                    </div>

                    {/* 1. Same host / Docker */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                      <span className="font-medium text-foreground">1. Kết nối trong cùng máy hoặc Docker</span>
                      <p className="text-muted-foreground text-xs">
                        Backend, agent chạy trên cùng server hoặc trong cùng docker-compose dùng URL trên (thường <code className="bg-muted px-1 rounded">http://qdrant:6333</code> hoặc <code className="bg-muted px-1 rounded">http://localhost:8010</code>). Biến môi trường: <code className="bg-muted px-1 rounded">QDRANT_URL</code>.
                      </p>
                    </div>

                    {/* 2. From external host (by IP) */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <span className="font-medium text-foreground">2. Kết nối từ hệ thống bên ngoài (qua IP)</span>
                      <p className="text-muted-foreground text-xs">
                        Công cụ chạy trên máy khác (máy trong LAN, server khác) cần trỏ tới <strong>IP của máy đang chạy Qdrant</strong>:
                      </p>
                      <p className="text-muted-foreground mt-1 break-all">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">http://&lt;IP_MÁY_CHỦ&gt;:8010</code>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Ví dụ: <code className="bg-muted px-1 rounded">http://192.168.1.100:8010</code> (thay 192.168.1.100 bằng IP thật của server). Cách xem IP: trên server chạy <code className="bg-muted px-1 rounded">ip addr</code> (Linux) hoặc <code className="bg-muted px-1 rounded">ipconfig</code> (Windows).
                      </p>
                      <ul className="text-muted-foreground text-xs list-disc list-inside space-y-0.5 mt-1.5">
                        <li><strong>Firewall:</strong> mở cổng 8010 (REST). Nếu dùng gRPC từ xa thì mở thêm 6334.</li>
                        <li><strong>Docker:</strong> nếu Qdrant chạy trong Docker, cần map port <code className="bg-muted px-0.5 rounded">8010:6333</code> (và <code className="bg-muted px-0.5 rounded">6334:6334</code> nếu dùng gRPC) trong docker-compose.</li>
                        <li><strong>Binding:</strong> Qdrant listen trong container ở 6333, host publish ra cổng 8010; production nên dùng reverse proxy hoặc firewall để giới hạn IP.</li>
                      </ul>
                    </div>

                    {/* 3. API example */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                      <span className="font-medium text-foreground">3. Ví dụ gọi API (REST)</span>
                      <p className="text-muted-foreground text-xs">Kiểm tra kết nối (root — trả về title, version):</p>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto mt-1">
{`curl "${qdrantUrl}/"`}
                      </pre>
                      <p className="text-muted-foreground text-xs mt-2">Liệt kê collections:</p>
                      <pre className="bg-muted p-2 rounded text-xs overflow-x-auto mt-1">
{`curl "${qdrantUrl}/collections"`}
                      </pre>
                    </div>

                    {/* 4. gRPC */}
                    <div>
                      <span className="font-medium text-foreground">4. gRPC</span>
                      <p className="text-muted-foreground text-xs mt-0.5">Cùng host với REST, cổng 6334. Client ngoài dùng <code className="bg-muted px-1 rounded">&lt;IP&gt;:6334</code>. Xem <a href="https://qdrant.tech/documentation/guides/grpc/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Qdrant gRPC</a>.</p>
                    </div>

                    {/* 5. Security */}
                    <div className="border-t pt-3">
                      <span className="font-medium text-foreground">5. Bảo mật</span>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Mặc định Qdrant không bật authentication — chỉ nên dùng trong mạng nội bộ/VPN. Production: bật API key, TLS; xem <a href="https://qdrant.tech/documentation/security/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Qdrant Security</a>.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={loadingHealth || loadingCollections}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${(loadingHealth || loadingCollections) ? "animate-spin" : ""}`} />
                Làm mới
              </Button>
            </div>
          </div>
          <CardDescription>
            URL: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{qdrantUrl}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            {loadingHealth ? (
              <span className="text-sm text-muted-foreground">Đang kiểm tra…</span>
            ) : isHealthy ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">Kết nối thành công</span>
                {health?.version && <span className="text-xs text-muted-foreground">({health.version})</span>}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {health?.error ?? `HTTP ${health?.status ?? "—"}`}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Collections</CardTitle>
          <CardDescription>Danh sách collection trong Qdrant. Bấm vào tên để xem chi tiết.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCollections ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không có collection nào hoặc không kết nối được Qdrant.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Tên</TableHead>
                  <TableHead className="text-right">Số points</TableHead>
                  <TableHead className="text-right">Vector size</TableHead>
                  <TableHead>Distance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((name) => {
                  const detail = collectionDetails[name]
                  const loading = loadingDetail === name
                  const isSelected = selectedCollection === name
                  return (
                    <TableRow
                      key={name}
                      className={isSelected ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => (detail ? setSelectedCollection(name) : loadCollectionDetail(name))}
                          disabled={loading}
                        >
                          {loading ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ChevronRight className={`h-3.5 w-3.5 ${detail ? "rotate-90" : ""}`} />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {detail != null ? detail.points_count.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {detail?.vector_size != null ? detail.vector_size : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {detail?.distance ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedCollection && collectionDetails[selectedCollection] && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chi tiết: {selectedCollection}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Points</dt>
                <dd className="font-mono tabular-nums">{collectionDetails[selectedCollection].points_count.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vectors</dt>
                <dd className="font-mono tabular-nums">{collectionDetails[selectedCollection].vectors_count.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Segments</dt>
                <dd className="font-mono tabular-nums">{collectionDetails[selectedCollection].segments_count}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vector size</dt>
                <dd className="font-mono">{collectionDetails[selectedCollection].vector_size ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Distance</dt>
                <dd className="font-mono">{collectionDetails[selectedCollection].distance ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{collectionDetails[selectedCollection].status ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Vector search by keyword */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Tìm kiếm vector theo từ khóa
          </CardTitle>
          <CardDescription>
            Chuyển từ khóa thành vector (embedding), tìm các vector tương tự trong collection. Cần cấu hình OPENAI_API_KEY hoặc REGULATIONS_EMBEDDING_URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <span className="text-xs text-muted-foreground">Collection</span>
              <Select
                value={searchCollection}
                onValueChange={setSearchCollection}
                disabled={!isHealthy || collections.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <span className="text-xs text-muted-foreground">Từ khóa</span>
              <Input
                placeholder="VD: quy chế NCKH, giờ chuẩn..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={!isHealthy}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={searchLoading || !isHealthy || !searchCollection.trim() || !searchKeyword.trim()}
              title={!searchCollection.trim() ? "Chọn collection trước" : !searchKeyword.trim() ? "Nhập từ khóa trước" : undefined}
            >
              <Search className={`h-4 w-4 mr-2 ${searchLoading ? "animate-pulse" : ""}`} />
              {searchLoading ? "Đang tìm (embedding + Qdrant, có thể mất 10–30 giây)…" : "Tìm kiếm"}
            </Button>
          </div>
          {searchResults && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/50">
                {searchResults.length} kết quả (sắp xếp theo độ tương đồng)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead className="w-20 text-right">Score</TableHead>
                    <TableHead>Nội dung (preview)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((p, i) => (
                    <Fragment key={`${p.id}-${i}`}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSearchExpanded(searchExpanded === `${p.id}-${i}` ? null : `${p.id}-${i}`)}
                      >
                        <TableCell>
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${searchExpanded === `${p.id}-${i}` ? "rotate-90" : ""}`} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{String(p.id)}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{p.score.toFixed(4)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={getPayloadText(p.payload)}>
                          {getPayloadText(p.payload)}
                        </TableCell>
                      </TableRow>
                      {searchExpanded === `${p.id}-${i}` && (
                        <TableRow key={`${p.id}-${i}-detail`}>
                          <TableCell colSpan={4} className="bg-muted/30 p-0">
                            <pre className="text-xs p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                              {JSON.stringify(p.payload, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Browse points in collection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <List className="h-4 w-4" />
            Duyệt points trong collection
          </CardTitle>
          <CardDescription>
            Xem danh sách points theo thứ tự (phân trang). Bấm vào hàng để xem chi tiết payload.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <span className="text-xs text-muted-foreground">Collection</span>
              <Select
                value={scrollCollection}
                onValueChange={(v) => {
                  setScrollCollection(v)
                  setScrollPoints([])
                  setScrollNextOffset(null)
                }}
                disabled={!isHealthy || collections.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => handleScrollLoad()}
              disabled={scrollLoading || !isHealthy || !scrollCollection.trim()}
            >
              <List className={`h-4 w-4 mr-2 ${scrollLoading ? "animate-pulse" : ""}`} />
              {scrollLoading ? "Đang tải…" : scrollPoints.length > 0 ? "Tải lại" : "Duyệt points"}
            </Button>
          </div>
          {scrollPoints.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/50">
                {scrollPoints.length} points
                {scrollNextOffset != null && (
                  <span className="ml-2">
                    · <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => handleScrollLoad(scrollNextOffset)} disabled={scrollLoading}>
                      Tải thêm
                    </Button>
                  </span>
                )}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-24">ID</TableHead>
                    <TableHead>Nội dung (preview)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scrollPoints.map((p, i) => (
                    <Fragment key={`${p.id}-${i}`}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setScrollExpanded(scrollExpanded === `${p.id}-${i}` ? null : `${p.id}-${i}`)}
                      >
                        <TableCell>
                          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${scrollExpanded === `${p.id}-${i}` ? "rotate-90" : ""}`} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{String(p.id)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={getPayloadText(p.payload)}>
                          {getPayloadText(p.payload)}
                        </TableCell>
                      </TableRow>
                      {scrollExpanded === `${p.id}-${i}` && (
                        <TableRow key={`${p.id}-${i}-detail`}>
                          <TableCell colSpan={3} className="bg-muted/30 p-0">
                            <pre className="text-xs p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                              {JSON.stringify(p.payload, null, 2)}
                            </pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
