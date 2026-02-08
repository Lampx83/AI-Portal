// lib/config.ts
// Ensure env is loaded
import "./env"

export const API_CONFIG = {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3001",
}

const LAKEFLOW_EMBED_PATH = "/search/embed"

/** Trợ lý Quy chế: URL embedding Datalake/LakeFlow. Tự chọn theo môi trường nếu không set. */
export function getRegulationsEmbeddingUrl(): string {
  const url = process.env.REGULATIONS_EMBEDDING_URL?.trim()
  if (url) return url
  const inDocker = process.env.RUNNING_IN_DOCKER === "true"
  const host = inDocker ? "http://host.docker.internal:8011" : "http://localhost:8011"
  return `${host}${LAKEFLOW_EMBED_PATH}`
}

/** Qdrant vector DB. Trong Docker dùng service name (qdrant:6333), local dùng QDRANT_URL hoặc localhost:8010. */
export function getQdrantUrl(): string {
  const inDocker = process.env.RUNNING_IN_DOCKER === "true"
  if (inDocker) return "http://qdrant:6333"
  const url = process.env.QDRANT_URL?.trim()
  return (url || "http://localhost:8010").replace(/\/+$/, "")
}

// Parse CORS_ORIGIN từ comma-separated string thành array hoặc string
const corsOriginEnv = process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3002"
export const CORS_ORIGIN: string | string[] = 
    corsOriginEnv.includes(",")
        ? corsOriginEnv.split(",").map(origin => origin.trim())
        : corsOriginEnv
