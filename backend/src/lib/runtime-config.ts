// Load runtime config from ai_portal.app_settings into process.env (so Admin → Settings can override without .env)
import { query } from "./db"
import { getDatabaseName } from "./db"

const ALLOWED_KEYS = new Set([
  "NEXTAUTH_SECRET", "NEXTAUTH_URL", "AUTH_TRUST_HOST",
  "AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "AZURE_AD_TENANT_ID",
  "ADMIN_SECRET", "ADMIN_REDIRECT_PATH",
  "OPENAI_API_KEY", "CORS_ORIGIN", "PRIMARY_DOMAIN",
  "PAPER_AGENT_URL", "EXPERT_AGENT_URL", "REVIEW_AGENT_URL", "PLAGIARISM_AGENT_URL",
  "LAKEFLOW_API_URL", "REGULATIONS_EMBEDDING_URL", "REGULATIONS_EMBEDDING_MODEL",
  "MINIO_ENDPOINT", "MINIO_PORT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET_NAME",
  "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET",
  "SERPAPI_KEY", "ADMIN_EMAILS",
])

let loaded = false

export async function loadRuntimeConfigFromDb(): Promise<void> {
  if (getDatabaseName() === "postgres") return
  try {
    const result = await query<{ key: string; value: string }>(
      "SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])",
      [Array.from(ALLOWED_KEYS)]
    )
    for (const row of result.rows) {
      if (ALLOWED_KEYS.has(row.key) && row.value !== undefined && row.value !== null) {
        process.env[row.key] = String(row.value).trim() || ""
      }
    }
    loaded = true
  } catch {
    // Schema or table may not exist yet (before setup)
  }
}

export function isRuntimeConfigLoaded(): boolean {
  return loaded
}

export function getAllowedKeys(): Set<string> {
  return new Set(ALLOWED_KEYS)
}
