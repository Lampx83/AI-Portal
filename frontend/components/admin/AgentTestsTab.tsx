"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAgents, getAgentTestResults, adminFetch, type AgentRow } from "@/lib/api/admin"

type RunRow = { id: string; run_at: string; total_agents: number; passed_count: number }
type ResultRow = {
  agent_alias: string
  metadata_pass: boolean | null
  data_documents_pass?: boolean | null
  data_experts_pass?: boolean | null
  ask_text_pass: boolean | null
  ask_file_pass: boolean | null
  metadata_ms?: number | null
  error_message?: string | null
}

export function AgentTestsTab() {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [runs, setRuns] = useState<RunRow[]>([])
  const [results, setResults] = useState<Record<string, ResultRow[]>>({})
  const [selectedRunId, setSelectedRunId] = useState<string>("")
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [running, setRunning] = useState(false)
  const [streamStatus, setStreamStatus] = useState("")
  const [streamCurrent, setStreamCurrent] = useState("")
  const [streamElapsed, setStreamElapsed] = useState("0.0s")
  const abortRef = useRef<AbortController | null>(null)

  const loadAgents = () => {
    setLoadingAgents(true)
    getAgents()
      .then((d) => {
        const list = (d.agents || []).filter((a) => a.is_active !== false)
        setAgents(list)
        setSelectedIds(new Set(list.map((a) => a.id)))
      })
      .finally(() => setLoadingAgents(false))
  }

  const loadRuns = () => {
    setLoadingRuns(true)
    getAgentTestResults(true)
      .then((d) => {
        const runList = (d.runs || []).map((r) => ({ ...r, id: String(r.id) }))
        setRuns(runList)
        setResults((d.results as Record<string, ResultRow[]>) || {})
        if (runList.length > 0 && !selectedRunId) setSelectedRunId(runList[0].id)
        else if (selectedRunId && runList.some((r) => r.id === selectedRunId)) {
          setSelectedRunId(selectedRunId)
        }
      })
      .finally(() => setLoadingRuns(false))
  }

  useEffect(() => {
    loadAgents()
    loadRuns()
  }, [])

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(agents.map((a) => a.id)))
    else setSelectedIds(new Set())
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const runTests = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      setStreamStatus("Vui lòng chọn ít nhất 1 agent.")
      return
    }
    setRunning(true)
    setStreamStatus("Đang kết nối...")
    setStreamCurrent("")
    abortRef.current = new AbortController()
    const start = Date.now()
    const tick = setInterval(() => {
      setStreamElapsed(((Date.now() - start) / 1000).toFixed(1) + "s")
    }, 200)

    try {
      const res = await adminFetch("/api/admin/agents/test-all-stream", {
        method: "POST",
        body: JSON.stringify({ agent_ids: ids }),
        signal: abortRef.current.signal,
      })
      if (!res.ok || !res.body) {
        setStreamStatus("Lỗi: " + res.status)
        setRunning(false)
        clearInterval(tick)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      const processBlock = (block: string) => {
        if (!block.trim()) return
        const eventMatch = block.match(/event: (\w+)/)
        const dataMatch = block.match(/data: ([\s\S]+)/)
        const eventType = eventMatch ? eventMatch[1] : "message"
        let data: Record<string, unknown> = {}
        try {
          data = dataMatch ? JSON.parse(dataMatch[1].trim()) : {}
        } catch (_) {}
        if (eventType === "start") {
          setRuns((prev) => prev)
          loadRuns()
        } else if (eventType === "agent") {
          setStreamCurrent((data.alias as string) || "")
        } else if (eventType === "endpoint") {
          setStreamCurrent(((data.agent as string) || "") + " — " + ((data.endpoint as string) || ""))
        } else if (eventType === "done") {
          setStreamStatus("Hoàn thành.")
          loadRuns()
        } else if (eventType === "error") {
          setStreamStatus("Lỗi: " + ((data.message as string) || "Unknown"))
        }
      }
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""
        for (const part of parts) processBlock(part)
      }
      if (buffer.trim()) processBlock(buffer)
      setStreamStatus("Hoàn thành.")
      loadRuns()
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") {
        setStreamStatus("Đã dừng. Kết quả đã lưu.")
        loadRuns()
      } else {
        setStreamStatus("Lỗi: " + (e as Error)?.message)
      }
    } finally {
      setRunning(false)
      clearInterval(tick)
      abortRef.current = null
    }
  }

  const stopTests = () => {
    if (abortRef.current) abortRef.current.abort()
  }

  const currentResults = selectedRunId ? results[selectedRunId] || [] : []

  const cell = (pass: boolean | null | undefined, ms?: number | null) => {
    if (pass === true) {
      const color = ms != null && ms < 500 ? "text-green-600" : ms != null && ms < 1500 ? "text-amber-600" : "text-orange-600"
      const msStr = ms != null ? (ms >= 1000 ? (ms / 1000).toFixed(1) + "s" : ms + "ms") : ""
      return <span className={color}>✓ {msStr}</span>
    }
    if (pass === false) return <span className="text-red-600">✗</span>
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Test toàn bộ Agents</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Chọn agents cần test. Chạy lần lượt: metadata, data, ask (text và file). Kết quả lưu vào database.
      </p>

      <div className="mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Chọn agents để test:</p>
        <div className="flex gap-4 mb-2">
          <Button variant="secondary" size="sm" onClick={() => toggleAll(true)}>
            Chọn tất cả
          </Button>
          <Button variant="secondary" size="sm" onClick={() => toggleAll(false)}>
            Bỏ chọn tất cả
          </Button>
        </div>
        {loadingAgents ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : (
          <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-md min-h-9">
            {agents.map((a) => (
              <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={selectedIds.has(a.id)}
                  onCheckedChange={(c) => toggleOne(a.id, c === true)}
                />
                {a.alias}
              </label>
            ))}
            {agents.length === 0 && (
              <span className="text-muted-foreground text-sm">Không có agent active</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Button onClick={runTests} disabled={running}>
          Chạy test Agents đã chọn
        </Button>
        {running && (
          <Button variant="destructive" onClick={stopTests}>
            Dừng
          </Button>
        )}
        <span className="text-sm text-muted-foreground">{streamStatus}</span>
      </div>

      {running && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
          <p><strong>Thời gian:</strong> {streamElapsed}</p>
          <p className="mt-1"><strong>Đang test:</strong> <span className="text-sky-600">{streamCurrent}</span></p>
        </div>
      )}

      <hr className="my-6 border-border" />
      <h3 className="text-base font-semibold mb-2">Lịch sử các lần chạy test</h3>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <Button variant="secondary" size="sm" onClick={loadRuns}>
          Làm mới
        </Button>
        <span className="text-sm text-muted-foreground">Tổng {runs.length} lần chạy</span>
      </div>

      <div className="mb-4 max-h-48 overflow-y-auto space-y-2">
        {loadingRuns ? (
          <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có lần chạy nào. Chạy test để tạo lịch sử.</p>
        ) : (
          runs.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedRunId(r.id)}
              className={`flex items-center justify-between p-2 rounded-md border cursor-pointer text-sm ${
                selectedRunId === r.id ? "bg-sky-50 dark:bg-sky-950/30 border-sky-200" : "bg-muted/30"
              }`}
            >
              <span>{new Date(r.run_at).toLocaleString("vi-VN")}</span>
              <span className={r.passed_count === r.total_agents && r.total_agents > 0 ? "text-green-600" : "text-amber-600"}>
                {r.passed_count}/{r.total_agents} pass
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mb-2">
        <label className="text-sm mr-2">Chọn lần chạy để xem chi tiết:</label>
        <Select value={selectedRunId} onValueChange={setSelectedRunId}>
          <SelectTrigger className="w-[320px] mt-1">
            <SelectValue placeholder="-- Chưa có lần chạy --" />
          </SelectTrigger>
          <SelectContent>
            {runs.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {new Date(r.run_at).toLocaleString("vi-VN")} — {r.passed_count}/{r.total_agents} pass
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md overflow-auto max-h-[400px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead className="text-center" title="/metadata">Metadata</TableHead>
              <TableHead className="text-center" title="Data">Data</TableHead>
              <TableHead className="text-center" title="Ask text">Ask text</TableHead>
              <TableHead className="text-center" title="Ask file">Ask file</TableHead>
              <TableHead>Lỗi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentResults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Chưa có kết quả. Chọn lần chạy ở trên hoặc bấm &quot;Chạy test Agents đã chọn&quot; để bắt đầu.
                </TableCell>
              </TableRow>
            ) : (
              currentResults.map((r, i) => (
                <TableRow key={r.agent_alias + i}>
                  <TableCell>{r.agent_alias}</TableCell>
                  <TableCell className="text-center">{cell(r.metadata_pass, r.metadata_ms)}</TableCell>
                  <TableCell className="text-center">
                    {cell(r.data_documents_pass === false || r.data_experts_pass === false ? false : r.data_documents_pass === true || r.data_experts_pass === true ? true : null)}
                  </TableCell>
                  <TableCell className="text-center">{cell(r.ask_text_pass)}</TableCell>
                  <TableCell className="text-center">{cell(r.ask_file_pass)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.error_message ?? ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
