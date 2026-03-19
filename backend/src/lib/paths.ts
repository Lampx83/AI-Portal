/**
 * Backend root and data directory. Trong Docker mount volume vào /app/data;
 * code chạy từ /app/dist nên __dirname = /app/dist/... → data mặc định là /app/dist/data (trong image, trống mỗi lần deploy).
 * Set BACKEND_ROOT=/app trong Docker để data = /app/data (volume), tránh mất setup-*.json sau mỗi lần deploy.
 */
import path from "path"

/** Root thư mục backend (trong Docker nên set env BACKEND_ROOT=/app). */
export function getBackendRoot(): string {
  const fromEnv = typeof process.env.BACKEND_ROOT === "string" && process.env.BACKEND_ROOT.trim()
  if (fromEnv) return path.resolve(process.env.BACKEND_ROOT!.trim())
  return path.join(__dirname, "..")
}

/** Thư mục data (setup-*.json, apps, ...). Trong Docker = /app/data khi BACKEND_ROOT=/app. */
export function getDataDir(): string {
  return path.join(getBackendRoot(), "data")
}
