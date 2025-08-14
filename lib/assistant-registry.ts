"use client"

export type SupportedModel = {
    model_id: string
    name: string
    description?: string
}

export type ProvidedDataType = {
    type: string
    description?: string
}

export type AgentMetadata = {
    name: string
    description: string
    version: string
    developer?: string
    capabilities?: string[]
    supported_models: SupportedModel[]
    sample_prompts?: string[]
    provided_data_types?: ProvidedDataType[]
    contact?: string
    status?: "active" | "inactive"
}

export type AssistantRecord = {
    alias: string
    baseUrl: string // ví dụ: http://localhost:3000/api/demo_agent/v1
    metadata: AgentMetadata
    addedAt: string // ISO
}

const STORAGE_KEY = "neu.assistants.registry"

function readStore(): AssistantRecord[] {
    if (typeof window === "undefined") return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? (JSON.parse(raw) as AssistantRecord[]) : []
    } catch {
        return []
    }
}

function writeStore(items: AssistantRecord[]) {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function listAssistants(): AssistantRecord[] {
    return readStore()
}

export function getAssistant(alias: string): AssistantRecord | undefined {
    return readStore().find((x) => x.alias === alias)
}

export function addAssistant(rec: AssistantRecord) {
    const items = readStore()
    if (items.some((x) => x.alias === rec.alias)) {
        throw new Error("ALIAS_EXISTS")
    }
    items.push(rec)
    writeStore(items)
}

export function suggestAliasFromName(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 48)
}

export async function fetchAgentMetadata(baseUrl: string): Promise<AgentMetadata> {
    const url = baseUrl.replace(/\/+$/, "") + "/metadata"
    const res = await fetch(url, { method: "GET" })
    if (!res.ok) {
        throw new Error(`FETCH_METADATA_FAILED_${res.status}`)
    }
    return (await res.json()) as AgentMetadata
}
