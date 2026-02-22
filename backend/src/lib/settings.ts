/**
 * Runtime config from Settings page (app_settings). Do not use process.env for app config.
 * Only process.env used: POSTGRES_*, NODE_ENV, PORT (bind).
 */
const cache: Record<string, string> = {}

/** Write to cache (called from loadRuntimeConfigFromDb). */
export function setSettingsCache(entries: Record<string, string>): void {
  for (const [k, v] of Object.entries(entries)) {
    if (v !== undefined && v !== null) cache[k] = String(v).trim()
  }
}

/** Read value from cache (app_settings). Returns default if missing. Does not read process.env. */
export function getSetting(key: string, defaultValue?: string): string {
  const v = cache[key]
  if (v !== undefined && v !== "") return v
  return defaultValue !== undefined ? defaultValue : ""
}

/** Only used at bootstrap when no DB yet: PORT, POSTGRES_*, NODE_ENV. */
export function getBootstrapEnv(key: string, defaultValue?: string): string {
  const v = typeof process.env[key] === "string" ? process.env[key]!.trim() : ""
  return v !== "" ? v : (defaultValue !== undefined ? defaultValue : "")
}

/** Return CORS origin (string or array) from setting. */
export function getCorsOrigin(): string | string[] {
  const v = getSetting("CORS_ORIGIN", "http://localhost:3000,http://localhost:3002")
  if (v.includes(",")) return v.split(",").map((s) => s.trim()).filter(Boolean)
  return v || "http://localhost:3000"
}
