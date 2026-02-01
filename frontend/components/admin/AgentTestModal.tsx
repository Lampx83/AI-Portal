"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { postAgentTest, getSampleFiles } from "@/lib/api/admin"

type MetadataResult = {
  supported_models?: { model_id: string; name?: string }[]
  sample_prompts?: string[]
  provided_data_types?: { type?: string }[] | string[]
}

export function AgentTestModal({
  open,
  onOpenChange,
  baseUrl,
  alias,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseUrl: string
  alias: string
}) {
  const [metadataResult, setMetadataResult] = useState<MetadataResult | null>(null)
  const [models, setModels] = useState<{ id: string; name: string }[]>([])
  const [prompts, setPrompts] = useState<string[]>([])
  const [dataTypes, setDataTypes] = useState<string[]>(["documents", "experts"])
  const [sampleFiles, setSampleFiles] = useState<Record<string, string>>({})
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini")
  const [selectedPrompt, setSelectedPrompt] = useState("Xin chào, bạn có thể giúp gì tôi?")
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState("")
  const [selectedDataType, setSelectedDataType] = useState("documents")
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [useCustomFileUrls, setUseCustomFileUrls] = useState(false)
  const [customFileUrls, setCustomFileUrls] = useState("")
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataRes, setMetadataRes] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(false)
  const [dataRes, setDataRes] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [askRes, setAskRes] = useState<string | null>(null)
  const { toast } = useToast()

  function copyCurl(cmd: string) {
    navigator.clipboard.writeText(cmd).then(() => {
      toast({ title: "Đã copy câu lệnh curl", duration: 2000 })
    }).catch(() => {
      toast({ title: "Không thể copy", variant: "destructive" })
    })
  }

  function getCurlMetadata() {
    const url = `${baseUrl.replace(/\/+$/, "")}/metadata`
    return `curl -X GET '${url}' -H 'Content-Type: application/json'`
  }

  function getCurlData() {
    const url = `${baseUrl.replace(/\/+$/, "")}/data?type=${encodeURIComponent(selectedDataType)}`
    return `curl -X GET '${url}' -H 'Content-Type: application/json'`
  }

  function getCurlAsk() {
    const promptVal = useCustomPrompt ? customPrompt.trim() : selectedPrompt || "Xin chào"
    const urls: string[] = []
    selectedFiles.forEach((fmt) => {
      if (sampleFiles[fmt]) urls.push(sampleFiles[fmt])
    })
    if (useCustomFileUrls) {
      customFileUrls.split(/\r?\n/).forEach((s) => {
        const t = s.trim()
        if (t) urls.push(t)
      })
    }
    const payload: Record<string, unknown> = {
      session_id: `test-${Date.now()}`,
      model_id: selectedModel,
      user: "admin-test",
      prompt: promptVal || "Xin chào",
    }
    if (urls.length > 0) {
      payload.context = { extra_data: { document: urls } }
    }
    const json = JSON.stringify(payload)
    const escaped = json.replace(/'/g, "'\\''")
    const url = `${baseUrl.replace(/\/+$/, "")}/ask`
    return `curl -X POST '${url}' -H 'Content-Type: application/json' -d '${escaped}'`
  }

  useEffect(() => {
    if (open && baseUrl) {
      setMetadataResult(null)
      setMetadataRes(null)
      setDataRes(null)
      setAskRes(null)
      setModels([{ id: "gpt-4o-mini", name: "gpt-4o-mini" }])
      setPrompts(["Xin chào, bạn có thể giúp gì tôi?"])
      setDataTypes(["documents", "experts"])
      setSelectedModel("gpt-4o-mini")
      setSelectedPrompt("Xin chào, bạn có thể giúp gì tôi?")
      setUseCustomPrompt(false)
      setCustomPrompt("")
      setSelectedDataType("documents")
      setSelectedFiles(new Set())
      setUseCustomFileUrls(false)
      setCustomFileUrls("")
      getSampleFiles()
        .then((d) => {
          const map: Record<string, string> = {}
          ;(d.files || []).forEach((f: { format: string; url: string }) => {
            map[f.format.toLowerCase()] = f.url
          })
          setSampleFiles(map)
        })
        .catch(() => setSampleFiles({}))
    }
  }, [open, baseUrl])

  // Tự động chạy /metadata khi mở modal (giống backend)
  useEffect(() => {
    if (!open || !baseUrl) return
    let cancelled = false
    setMetadataLoading(true)
    setMetadataRes(null)
    postAgentTest({ base_url: baseUrl, test_type: "metadata" })
      .then((d) => {
        if (cancelled) return
        setMetadataRes(JSON.stringify(d, null, 2))
        if (d.ok && d.data) {
          const m = d.data as MetadataResult
          setMetadataResult(m)
          const modelList = m.supported_models || []
          setModels(modelList.length > 0 ? modelList.map((x) => ({ id: x.model_id, name: x.name || x.model_id })) : [{ id: "gpt-4o-mini", name: "gpt-4o-mini" }])
          const promptList = m.sample_prompts || []
          setPrompts(promptList.length > 0 ? promptList : ["Xin chào, bạn có thể giúp gì tôi?"])
          const types = (m.provided_data_types || []).map((dt) => (typeof dt === "string" ? dt : dt?.type)).filter((t): t is string => !!t)
          setDataTypes(types.length > 0 ? types : ["documents", "experts"])
          if (modelList.length > 0) setSelectedModel(modelList[0].model_id)
          if (promptList.length > 0) setSelectedPrompt(promptList[0])
        }
      })
      .catch((e) => {
        if (!cancelled) setMetadataRes("Lỗi: " + (e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setMetadataLoading(false)
      })
    return () => { cancelled = true }
  }, [open, baseUrl])

  const runMetadata = async () => {
    if (!baseUrl) return
    setMetadataLoading(true)
    setMetadataRes(null)
    try {
      const d = await postAgentTest({ base_url: baseUrl, test_type: "metadata" })
      setMetadataRes(JSON.stringify(d, null, 2))
      if (d.ok && d.data) {
        const m = d.data as MetadataResult
        setMetadataResult(m)
        const modelList = m.supported_models || []
        setModels(modelList.length > 0 ? modelList.map((x) => ({ id: x.model_id, name: x.name || x.model_id })) : [{ id: "gpt-4o-mini", name: "gpt-4o-mini" }])
        const promptList = m.sample_prompts || []
        setPrompts(promptList.length > 0 ? promptList : ["Xin chào, bạn có thể giúp gì tôi?"])
        const types = (m.provided_data_types || []).map((dt) => (typeof dt === "string" ? dt : dt?.type)).filter((t): t is string => !!t)
        setDataTypes(types.length > 0 ? types : ["documents", "experts"])
        if (modelList.length > 0) setSelectedModel(modelList[0].model_id)
        if (promptList.length > 0) setSelectedPrompt(promptList[0])
      }
    } catch (e) {
      setMetadataRes("Lỗi: " + (e as Error).message)
    } finally {
      setMetadataLoading(false)
    }
  }

  const runData = async () => {
    if (!baseUrl) return
    setDataLoading(true)
    setDataRes(null)
    try {
      const d = await postAgentTest({ base_url: baseUrl, test_type: "data", data_type: selectedDataType })
      setDataRes(JSON.stringify(d, null, 2))
    } catch (e) {
      setDataRes("Lỗi: " + (e as Error).message)
    } finally {
      setDataLoading(false)
    }
  }

  const runAsk = async () => {
    if (!baseUrl) return
    const promptVal = useCustomPrompt ? customPrompt.trim() : selectedPrompt || "Xin chào"
    const urls: string[] = []
    selectedFiles.forEach((fmt) => {
      if (sampleFiles[fmt]) urls.push(sampleFiles[fmt])
    })
    if (useCustomFileUrls) {
      customFileUrls.split(/\r?\n/).forEach((s) => {
        const t = s.trim()
        if (t) urls.push(t)
      })
    }
    setAskLoading(true)
    setAskRes(null)
    try {
      const d = await postAgentTest({
        base_url: baseUrl,
        test_type: "ask",
        model_id: selectedModel,
        prompt: promptVal || "Xin chào",
        document_urls: urls.length > 0 ? urls : undefined,
      })
      setAskRes(JSON.stringify(d, null, 2))
    } catch (e) {
      setAskRes("Lỗi: " + (e as Error).message)
    } finally {
      setAskLoading(false)
    }
  }

  const toggleFile = (format: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      if (next.has(format)) next.delete(format)
      else next.add(format)
      return next
    })
  }

  const fileFormats = Object.keys(sampleFiles)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden grid grid-rows-[auto_1fr] gap-4">
        <DialogHeader className="min-h-0">
          <DialogTitle>🧪 Test Agent: {alias}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="metadata" className="min-h-0 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-3 shrink-0">
            <TabsTrigger value="metadata">/metadata</TabsTrigger>
            <TabsTrigger value="data">/data</TabsTrigger>
            <TabsTrigger value="ask">/ask</TabsTrigger>
          </TabsList>
          <div className="min-h-0 overflow-y-auto overflow-x-hidden pr-2 -mr-2 mt-3">
            <TabsContent value="metadata" className="mt-0">
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={runMetadata} disabled={metadataLoading}>
                    {metadataLoading ? "Đang test..." : "Test /metadata"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyCurl(getCurlMetadata())}>
                    Curl
                  </Button>
                </div>
                {metadataRes && (
                  <pre className={`p-3 rounded-md text-xs overflow-auto max-h-[50vh] ${metadataRes.includes('"ok":true') || metadataRes.includes('"ok": true') ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                    {metadataRes}
                  </pre>
                )}
              </div>
            </TabsContent>
            <TabsContent value="data" className="mt-0">
              <div className="space-y-3">
                <div className="flex gap-2 items-center">
                  <Label>data_type:</Label>
                  <Select value={selectedDataType} onValueChange={setSelectedDataType}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dataTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={runData} disabled={dataLoading}>
                    {dataLoading ? "Đang test..." : "Test /data"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyCurl(getCurlData())}>
                    Curl
                  </Button>
                </div>
                {dataRes && (
                  <pre className={`p-3 rounded-md text-xs overflow-auto max-h-[50vh] ${dataRes.includes('"ok":true') || dataRes.includes('"ok": true') ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                    {dataRes}
                  </pre>
                )}
              </div>
            </TabsContent>
            <TabsContent value="ask" className="mt-0">
              <div className="space-y-3">
                <div>
                  <Label>Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prompt</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Checkbox checked={useCustomPrompt} onCheckedChange={(c) => setUseCustomPrompt(c === true)} />
                    <span className="text-xs">Dùng prompt tùy chỉnh</span>
                  </div>
                  {useCustomPrompt ? (
                    <Textarea
                      className="mt-1"
                      rows={2}
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Nhập prompt..."
                    />
                  ) : (
                    <Select value={selectedPrompt} onValueChange={setSelectedPrompt}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {prompts.map((p, i) => (
                          <SelectItem key={i} value={p}>
                            {p.length > 50 ? p.slice(0, 47) + "..." : p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {fileFormats.length > 0 && (
                  <div>
                    <Label>File (document_urls)</Label>
                    <div className="flex flex-wrap gap-4 mt-1">
                      {fileFormats.map((fmt) => (
                        <label key={fmt} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedFiles.has(fmt)}
                            onCheckedChange={() => toggleFile(fmt)}
                          />
                          {fmt}
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-sm mt-2">
                      <Checkbox checked={useCustomFileUrls} onCheckedChange={(c) => setUseCustomFileUrls(c === true)} />
                      Tùy chọn URL
                    </label>
                    {useCustomFileUrls && (
                      <Textarea
                        className="mt-1"
                        rows={2}
                        value={customFileUrls}
                        onChange={(e) => setCustomFileUrls(e.target.value)}
                        placeholder="https://... (mỗi dòng một URL)"
                      />
                    )}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={runAsk} disabled={askLoading}>
                    {askLoading ? "Đang test..." : "Test /ask"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyCurl(getCurlAsk())}>
                    Curl
                  </Button>
                </div>
                {askRes && (
                  <pre className={`p-3 rounded-md text-xs overflow-auto max-h-[50vh] ${askRes.includes('"ok":true') || askRes.includes('"ok": true') ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                    {askRes}
                  </pre>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
