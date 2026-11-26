/**
 * Đảm bảo bảng giám sát tồn tại (chạy lại an toàn). Dùng chính file migrations/024_monitoring.sql để
 * không lặp định nghĩa; gọi lúc khởi động và trước truy vấn đầu tiên — phòng trường hợp số phiên bản
 * migration trùng với nhánh khác nên runner bỏ qua.
 */
import fs from "fs"
import path from "path"
import { query } from "../db"
import { getBackendRoot } from "../paths"

const MIGRATION_FILE = "024_monitoring.sql"
let ensured: Promise<boolean> | null = null

export function ensureMonitoringTables(): Promise<boolean> {
  if (!ensured) {
    ensured = (async () => {
      try {
        const candidates = [
          path.join(getBackendRoot(), "migrations", MIGRATION_FILE),
          path.join(__dirname, "..", "..", "..", "migrations", MIGRATION_FILE),
        ]
        const file = candidates.find((f) => fs.existsSync(f))
        if (!file) throw new Error(`${MIGRATION_FILE} not found`)
        const sql = fs.readFileSync(file, "utf8")
        await query(sql)
        return true
      } catch (e: any) {
        console.warn("[monitoring] ensure tables failed:", e?.message ?? e)
        ensured = null // thử lại lần sau
        return false
      }
    })()
  }
  return ensured
}
