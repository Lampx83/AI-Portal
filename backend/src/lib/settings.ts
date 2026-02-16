/**
 * Cấu hình runtime từ trang Settings (app_settings). Không dùng process.env cho app config.
 * Chỉ process.env dùng: POSTGRES_*, NODE_ENV, PORT (bind).
 */
const cache: Record<string, string> = {}

/** Ghi cache (gọi từ loadRuntimeConfigFromDb). */
export function setSettingsCache(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined && v !== null) cache[k] = String(v).trim()
  }
}

/** Đọc giá trị từ cache (app_settings). Trả về default nếu chưa có. Không đọc process.env. */
export function getSetting(key: string, defaultValue?: string): string {
  const v = cache[key]
  if (v !== undefined && v !== "") return v
  return defaultValue !== undefined ? defaultValue : ""
}

/** Chỉ dùng tại bootstrap khi chưa có DB: PORT, POSTGRES_*, NODE_ENV. */
export function getBootstrapEnv(key: string, defaultValue?: string): string {
  const v = typeof process.env[key] === "string" ? process.env[key]!.trim() : ""
  return v !== "" ? v : (defaultValue !== undefined ? defaultValue : "")
}

/** Trả về CORS origin (string hoặc array) từ setting. */
export function getCorsOrigin(): string | string[] {
  const v = getSetting("CORS_ORIGIN", "http://localhost:3000,http://localhost:3002")
  if (v.includes(",")) return v.split(",").map((s) => s.trim()).filter(Boolean)
  return v || "http://localhost:3000"
}
