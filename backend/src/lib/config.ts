// lib/config.ts – Cấu hình từ Settings (getSetting), không dùng process.env
import { getSetting, getCorsOrigin as getCorsOriginFromSettings } from "./settings"

export function getApiBaseUrl(): string {
  return getSetting("API_BASE_URL", "http://localhost:3001")
}

export const API_CONFIG = {
  get baseUrl() { return getApiBaseUrl() },
}

const LAKEFLOW_EMBED_PATH = "/search/embed"

/** Trợ lý Quy chế: URL embedding. Cấu hình tại Admin → Settings. */
export function getRegulationsEmbeddingUrl(): string {
  const url = getSetting("REGULATIONS_EMBEDDING_URL").trim()
  const inDocker = getSetting("RUNNING_IN_DOCKER") === "true"
  if (url) {
    if (inDocker && /localhost|127\.0\.0\.1/.test(url)) return getLakeFlowApiUrl() + LAKEFLOW_EMBED_PATH
    return url
  }
  return getLakeFlowApiUrl() + LAKEFLOW_EMBED_PATH
}

/** Qdrant vector DB. Chỉ hoạt động khi plugin Qdrant bật (Admin → Settings). */
export function getQdrantUrl(): string {
  if (getSetting("plugin_qdrant_enabled") !== "true") return ""
  const adminUrl = getSetting("qdrant_url").trim()
  if (adminUrl) return adminUrl.replace(/\/+$/, "")
  const inDocker = getSetting("RUNNING_IN_DOCKER") === "true"
  if (inDocker) return "http://qdrant:6333"
  const url = getSetting("QDRANT_URL", "http://localhost:8010").trim()
  return (url || "http://localhost:8010").replace(/\/+$/, "")
}

/** URL Qdrant cho Datalake pipeline. Cấu hình tại Admin → Settings. */
export function getQdrantUrlForDatalake(): string {
  const url = getSetting("QDRANT_EXTERNAL_URL").trim()
  if (url) return url.replace(/\/+$/, "")
  const inDocker = getSetting("RUNNING_IN_DOCKER") === "true"
  const port = getSetting("QDRANT_PORT", "8010").trim() || "8010"
  if (inDocker) return `http://host.docker.internal:${port}`
  return `http://localhost:${port}`
}

/** Datalake/LakeFlow API. Cấu hình tại Admin → Settings. */
export function getLakeFlowApiUrl(): string {
  const url = getSetting("LAKEFLOW_API_URL").trim()
  if (url) return url.replace(/\/+$/, "")
  const inDocker = getSetting("RUNNING_IN_DOCKER") === "true"
  const port = getSetting("LAKEFLOW_PORT", "8011").trim() || "8011"
  if (inDocker) return `http://host.docker.internal:${port}`
  return `http://localhost:${port}`
}

export const CORS_ORIGIN: string | string[] = getCorsOriginFromSettings()
