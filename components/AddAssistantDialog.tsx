"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Check, Loader2, Globe } from "lucide-react"
import { fetchWithTimeout, normalizeBaseUrl } from "@/lib/fetch-utils"
import type { AgentMetadata, AssistantRecord } from "@/lib/agent-types"
import { useAssistantsStore } from "@/lib/assistants-store"
import { useRouter } from "next/navigation"

type Props = {
    open: boolean
    onOpenChange: (v: boolean) => void
}

export default function AddAssistantDialog({ open, onOpenChange }: Props) {
    const [baseUrl, setBaseUrl] = useState("")
    const [alias, setAlias] = useState("")
    const [metadata, setMetadata] = useState<AgentMetadata | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const addAssistant = useAssistantsStore((s) => s.addAssistant)
    const router = useRouter()

    const canPreview = baseUrl.trim().length > 0
    const canAdd = !!metadata && alias.trim().length > 0

    const handlePreview = async () => {
        setError(null)
        setMetadata(null)
        setLoading(true)
        try {
            const normalized = normalizeBaseUrl(baseUrl.trim())
            const res = await fetchWithTimeout(`${normalized}/metadata`, { timeoutMs: 8000 })
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`)
            }
            const data = (await res.json()) as AgentMetadata
            // Validate tối thiểu
            if (!data?.name || !Array.isArray(data?.supported_models)) {
                throw new Error("Metadata không đúng chuẩn hoặc thiếu trường bắt buộc.")
            }
            setMetadata(data)
            if (!alias) {
                // gợi ý alias từ name
                const suggest = (data.name || "agent")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                setAlias(suggest)
            }
        } catch (e: any) {
            setError(`Không thể tải metadata: ${e?.message || e}`)
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = () => {
        if (!metadata) return
        const normalized = normalizeBaseUrl(baseUrl.trim())
        const rec: AssistantRecord = {
            alias: alias.trim().toLowerCase(),
            baseUrl: normalized,
            metadata,
            createdAt: new Date().toISOString(),
        }
        addAssistant(rec)
        onOpenChange(false)
        // Điều hướng tới trang trợ lý
        router.push(`/assistants/${rec.alias}`)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Thêm trợ lý AI</DialogTitle>
                    <DialogDescription>Nhập URL base của Agent (ví dụ: https://research.neu.edu.vn/api/demo_agent/v1)</DialogDescription>
                </DialogHeader>

                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="baseUrl">Agent Base URL</Label>
                        <div className="flex gap-2">
                            <Input
                                id="baseUrl"
                                placeholder="https://research.neu.edu.vn/api/demo_agent/v1"
                                value={baseUrl}
                                onChange={(e) => setBaseUrl(e.target.value)}
                            />
                            <Button onClick={handlePreview} disabled={!canPreview || loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                                Lấy thông tin
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertTitle>Lỗi</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {metadata && (
                        <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="text-base font-semibold">{metadata.name}</div>
                                    <div className="text-sm text-muted-foreground">{metadata.description}</div>
                                </div>
                                <span className="text-xs text-muted-foreground">v{metadata.version || "1.0.0"}</span>
                            </div>

                            {metadata.capabilities?.length ? (
                                <div className="text-sm">
                                    <span className="font-medium">Capabilities: </span>
                                    {metadata.capabilities.join(", ")}
                                </div>
                            ) : null}

                            {metadata.supported_models?.length ? (
                                <div className="text-sm">
                                    <span className="font-medium">Models: </span>
                                    {metadata.supported_models.map((m) => m.model_id).join(", ")}
                                </div>
                            ) : null}

                            {metadata.provided_data_types?.length ? (
                                <div className="text-sm">
                                    <span className="font-medium">Data types (/data): </span>
                                    {metadata.provided_data_types.map((d) => d.type).join(", ")}
                                </div>
                            ) : null}

                            {metadata.sample_prompts?.length ? (
                                <div className="text-sm">
                                    <span className="font-medium">Sample prompts:</span>
                                    <ul className="list-disc pl-5 mt-1">
                                        {metadata.sample_prompts.slice(0, 3).map((p, i) => (
                                            <li key={i} className="text-muted-foreground">{p}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="alias">Alias</Label>
                                <Input
                                    id="alias"
                                    placeholder="đặt bí danh để truy cập (ví dụ: doc-assistant)"
                                    value={alias}
                                    onChange={(e) => setAlias(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Hủy
                        </Button>
                        <Button onClick={handleAdd} disabled={!canAdd}>
                            <Check className="mr-2 h-4 w-4" />
                            Thêm trợ lý
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
