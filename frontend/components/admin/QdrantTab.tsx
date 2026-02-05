"use client"

import { useEffect, useState, useCallback } from "react"
import { Database, RefreshCw, ChevronRight, Server, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getQdrantHealth,
  getQdrantCollections,
  getQdrantCollection,
  type QdrantHealth as QdrantHealthType,
  type QdrantCollectionInfo,
} from "@/lib/api/admin"
import { useToast } from "@/hooks/use-toast"

export function QdrantTab() {
  const { toast } = useToast()
  const [health, setHealth] = useState<QdrantHealthType | null>(null)
  const [collections, setCollections] = useState<string[]>([])
  const [collectionDetails, setCollectionDetails] = useState<Record<string, QdrantCollectionInfo>>({})
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(true)
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [urlFromCollections, setUrlFromCollections] = useState<string | null>(null)

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

  useEffect(() => {
    loadHealth()
    loadCollections()
  }, [loadHealth, loadCollections])

  const qdrantUrl = health?.url ?? urlFromCollections ?? "http://101.96.66.224:6333"
  const isHealthy = health?.ok === true

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" />
          Qdrant Vector Database
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Máy chủ NCT-223 (Public: 101.96.66.223, Private: 10.2.13.54). Cổng mặc định 6333. Dùng cho trợ lý &quot;Quy chế, quy định&quot;.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4" />
              Kết nối
            </CardTitle>
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loadingHealth || loadingCollections}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${(loadingHealth || loadingCollections) ? "animate-spin" : ""}`} />
              Làm mới
            </Button>
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
    </div>
  )
}
