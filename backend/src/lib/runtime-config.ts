// Load runtime config from ai_portal.app_settings into cache (Settings), do not write process.env
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
  "MINIO_ENDPOINT_PUBLIC", "MINIO_PUBLIC_BASE_URL",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET",
  "SERPAPI_KEY", "ADMIN_EMAILS",
  "BACKEND_URL", "API_BASE_URL", "FRONTEND_URL", "NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_WS_URL",
  "QDRANT_URL", "QDRANT_PORT", "QDRANT_EXTERNAL_URL", "QDRANT_COLLECTION_REGULATIONS",
  "plugin_qdrant_enabled", "qdrant_url",
  "RUNNING_IN_DOCKER", "CENTRAL_AGENT_BASE_URL", "DATA_AGENT_PACKAGE_URL",
  "DEBUG",
  "OLLAMA_BASE_URL",
])

/** Env container (Docker/Deploy.sh) phải thắng DB nếu admin từng lưu hostname nội bộ (minio) — không thì upload vẫn trả http://minio:9000/... */
const ENV_OVERRIDES_DB_WHEN_SET = new Set(["MINIO_PUBLIC_BASE_URL", "MINIO_ENDPOINT_PUBLIC"])

function mergeEnvIntoMap(map: Record<string, string>): void {
  for (const key of ALLOWED_KEYS) {
    const envVal = typeof process.env[key] === "string" ? process.env[key]!.trim() : ""
    if (ENV_OVERRIDES_DB_WHEN_SET.has(key)) {
      if (envVal) map[key] = envVal
      continue
    }
    if (map[key]) continue
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
  // Fallback: values not in DB are read from process.env (.env) so Admin can be reached on first run
  mergeEnvIntoMap(map)
  setSettingsCache(map)
}

export function getAllowedKeys(): Set<string> {
  return new Set(ALLOWED_KEYS)
}
