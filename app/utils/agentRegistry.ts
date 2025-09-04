// utils/agentRegistry.ts
export type AgentMetadata = {
    name: string
    description: string
    version: string
    developer?: string
    capabilities?: string[]
    supported_models?: { model_id: string; name: string; description?: string }[]
    sample_prompts?: string[]
    provided_data_types?: { type: string; description?: string }[]
    contact?: string
    status?: "active" | "inactive" | string
}

export type AgentEntry = {
    alias: string
    baseUrl: string
    metadata: AgentMetadata
}

const KEY = "customAgents.v1"

export function getAgents(): AgentEntry[] {
    if (typeof window === "undefined") return []
    try {
        const raw = localStorage.getItem(KEY)
        return raw ? (JSON.parse(raw) as AgentEntry[]) : []
    } catch {
        return []
    }
}

export function getAgentByAlias(alias: string): AgentEntry | undefined {
    return getAgents().find((a) => a.alias === alias)
}

export function addAgent(entry: AgentEntry) {
    const list = getAgents()
    if (list.some((a) => a.alias === entry.alias)) {
        throw new Error("Alias đã tồn tại. Hãy chọn alias khác.")
    }
    list.push(entry)
    localStorage.setItem(KEY, JSON.stringify(list))
}

export function removeAgent(alias: string) {
    const list = getAgents().filter((a) => a.alias !== alias)
    localStorage.setItem(KEY, JSON.stringify(list))
}
