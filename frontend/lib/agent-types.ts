// lib/agent-types.ts
export type ProvidedDataType = {
    type: string
    description?: string
}

export type SupportedModel = {
    model_id: string
    name: string
    description?: string
    accepted_file_types:string[]
}

export type AgentMetadata = {
    name: string
    description?: string
    version?: string
    developer?: string
    capabilities?: string[]
    supported_models?: SupportedModel[]
    sample_prompts?: string[]
    provided_data_types?: ProvidedDataType[]
    contact?: string
    status?: "active" | "inactive"
    baseUrl?: string
}

// Thông tin trợ lý do mình quản lý trong app
export type AssistantRecord = {
    alias: string
    baseUrl: string              // ví dụ: http://localhost:3000/api/demo_agent/v1
    metadata: AgentMetadata
    createdAt: string
}