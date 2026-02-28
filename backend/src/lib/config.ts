// lib/config.ts – Config from Settings (getSetting), not process.env
import { getSetting } from "./settings"

/** Embedding URL (for Qdrant search, etc.). Configure in Admin → Settings. */
export function getRegulationsEmbeddingUrl(): string {
  return getSetting("REGULATIONS_EMBEDDING_URL").trim()
}

/** Qdrant vector DB. Only active when Qdrant plugin is enabled (Admin → Settings). */
export function getQdrantUrl(): string {
  if (getSetting("plugin_qdrant_enabled") !== "true") return ""
  const adminUrl = getSetting("qdrant_url").trim()
  if (adminUrl) return adminUrl.replace(/\/+$/, "")
  const inDocker = getSetting("RUNNING_IN_DOCKER") === "true"
  if (inDocker) return "http://qdrant:6333"
  const url = getSetting("QDRANT_URL", "").trim()
  return (url || "").replace(/\/+$/, "")
}
