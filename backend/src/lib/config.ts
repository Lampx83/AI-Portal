// lib/config.ts – Cấu hình từ Settings (getSetting), không dùng process.env
import { getSetting, getCorsOrigin as getCorsOriginFromSettings } from "./settings"

export function getApiBaseUrl(): string {
  return getSetting("API_BASE_URL", "http://localhost:3001")
}

export const API_CONFIG = {
  get baseUrl() { return getApiBaseUrl() },
}

/** URL embedding (dùng cho Qdrant search, v.v.). Cấu hình tại Admin → Settings. */
export function getRegulationsEmbeddingUrl(): string {
  return getSetting("REGULATIONS_EMBEDDING_URL").trim()
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

export const CORS_ORIGIN: string | string[] = getCorsOriginFromSettings()
