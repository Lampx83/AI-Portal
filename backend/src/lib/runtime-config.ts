// Load runtime config from ai_portal.app_settings vào cache (Settings), không ghi process.env
import { query } from "./db"
import { getDatabaseName } from "./db"
import { setSettingsCache } from "./settings"

const ALLOWED_KEYS = new Set([
  "NEXTAUTH_SECRET", "NEXTAUTH_URL", "AUTH_TRUST_HOST",
  "AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "AZURE_AD_TENANT_ID",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
  "ADMIN_SECRET", "ADMIN_REDIRECT_PATH",
  "CORS_ORIGIN", "PRIMARY_DOMAIN", "PORT",
  "PAPER_AGENT_URL", "EXPERT_AGENT_URL", "REVIEW_AGENT_URL", "PLAGIARISM_AGENT_URL",
  "REGULATIONS_EMBEDDING_URL", "REGULATIONS_EMBEDDING_MODEL",
  "MINIO_ENDPOINT", "MINIO_PORT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET_NAME",
  "MINIO_ENDPOINT_PUBLIC",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET",
  "SERPAPI_KEY", "ADMIN_EMAILS",
  "BACKEND_URL", "API_BASE_URL", "FRONTEND_URL", "NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_WS_URL",
  "QDRANT_URL", "QDRANT_PORT", "QDRANT_EXTERNAL_URL", "QDRANT_COLLECTION_REGULATIONS",
  "plugin_qdrant_enabled", "qdrant_url",
  "RUNNING_IN_DOCKER", "CENTRAL_AGENT_BASE_URL", "DATA_AGENT_PACKAGE_URL",
  "DEBUG",
])

let loaded = false

function mergeEnvIntoMap(map: Record<string, string>): void {
  for (const key of ALLOWED_KEYS) {
    if (map[key]) continue
    const envVal = typeof process.env[key] === "string" ? process.env[key]!.trim() : ""
    if (envVal) map[key] = envVal
  }
}

export async function loadRuntimeConfigFromDb(): Promise<void> {
  const map: Record<string, string> = {}
  if (getDatabaseName() !== "postgres") {
    try {
      const result = await query<{ key: string; value: string }>(
        "SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])",
        [Array.from(ALLOWED_KEYS)]
      )
      for (const row of result.rows) {
        if (ALLOWED_KEYS.has(row.key) && row.value !== undefined && row.value !== null) {
          const v = String(row.value).trim()
          if (v) map[row.key] = v
        }
      }
    } catch {
      // Schema or table may not exist yet (before setup)
    }
  }
  // Fallback: giá trị chưa có trong DB thì lấy từ process.env (.env) để có thể vào Admin lần đầu
  mergeEnvIntoMap(map)
  setSettingsCache(map)
  loaded = true
}

export function isRuntimeConfigLoaded(): boolean {
  return loaded
}

export function getAllowedKeys(): Set<string> {
  return new Set(ALLOWED_KEYS)
}
