// lib/config.ts
// Ensure env is loaded
import "./env"

export const API_CONFIG = {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3001",
}

const LAKEFLOW_EMBED_PATH = "/search/embed"

/** Trợ lý Quy chế: URL embedding Datalake/LakeFlow. Nếu không set REGULATIONS_EMBEDDING_URL thì dùng getLakeFlowApiUrl() + /search/embed. Khi chạy Docker mà URL set là localhost → dùng getLakeFlowApiUrl() để trỏ ra host (host.docker.internal). */
export function getRegulationsEmbeddingUrl(): string {
  const url = process.env.REGULATIONS_EMBEDDING_URL?.trim()
  const inDocker = process.env.RUNNING_IN_DOCKER === "true"
  if (url) {
    if (inDocker && /localhost|127\.0\.0\.1/.test(url)) return getLakeFlowApiUrl() + LAKEFLOW_EMBED_PATH
    return url
  }
  return getLakeFlowApiUrl() + LAKEFLOW_EMBED_PATH
}

/** Qdrant vector DB. Trong Docker dùng service name (qdrant:6333), local dùng QDRANT_URL hoặc localhost:8010. */
export function getQdrantUrl(): string {
  const inDocker = process.env.RUNNING_IN_DOCKER === "true"
  if (inDocker) return "http://qdrant:6333"
  const url = process.env.QDRANT_URL?.trim()
  return (url || "http://localhost:8010").replace(/\/+$/, "")
}

/** URL Qdrant Research để Datalake pipeline (step4) ghi vector vào. Datalake gọi từ host/container khác nên cần URL reachable: Docker = host.docker.internal:8010, local = localhost:8010. Có thể override bằng RESEARCH_QDRANT_EXTERNAL_URL. */
export function getQdrantUrlForDatalake(): string {
  const url = process.env.RESEARCH_QDRANT_EXTERNAL_URL?.trim()
  if (url) return url.replace(/\/+$/, "")
  const inDocker = process.env.RUNNING_IN_DOCKER === "true"
  const port = process.env.QDRANT_PORT?.trim() || "8010"
  if (inDocker) return `http://host.docker.internal:${port}`
  return `http://localhost:${port}`
}

/** Datalake/LakeFlow API (inbox, upload). Cùng cách xử lý như getQdrantUrlForDatalake: override bằng LAKEFLOW_API_URL; không set thì Docker = host.docker.internal:LAKEFLOW_PORT, local = localhost:LAKEFLOW_PORT. */
export function getLakeFlowApiUrl(): string {
  const url = process.env.LAKEFLOW_API_URL?.trim()
  if (url) return url.replace(/\/+$/, "")
  const inDocker = process.env.RUNNING_IN_DOCKER === "true"
  const port = process.env.LAKEFLOW_PORT?.trim() || "8011"
  if (inDocker) return `http://host.docker.internal:${port}`
  return `http://localhost:${port}`
}

// Parse CORS_ORIGIN từ comma-separated string thành array hoặc string
const corsOriginEnv = process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3002"
export const CORS_ORIGIN: string | string[] = 
    corsOriginEnv.includes(",")
        ? corsOriginEnv.split(",").map(origin => origin.trim())
        : corsOriginEnv
