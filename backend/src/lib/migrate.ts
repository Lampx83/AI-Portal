/**
 * Migration runner: chạy các file SQL trong migrations/ theo thứ tự.
 * Mỗi migration có số phiên bản (001_, 002_, ...). Chỉ chạy migrations chưa áp dụng.
 * Phiên bản lưu trong ai_portal.schema_version.
 */
import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { getDatabaseName, query } from "./db"
import { getBootstrapEnv } from "./settings"

const BACKEND_ROOT = path.join(__dirname, "..", "..")
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, "migrations")

/** Migrations áp dụng cho schema ai_portal (cần ai_portal tồn tại) */
const SCHEMA_MIGRATIONS = /^(\d+)_[a-z0-9_-]+\.sql$/
/** 001_create_enums chạy trước restore (types trong public, không phụ thuộc ai_portal) */
const PREREQ_MIGRATION = "001_create_enums.sql"

/** Lấy phiên bản hiện tại từ schema_version, trả về 0 nếu chưa có. */
async function getCurrentVersion(): Promise<number> {
  try {
    const r = await query<{ max: number }>(
      "SELECT COALESCE(MAX(version), 0) AS max FROM ai_portal.schema_version"
    )
    return Number(r.rows[0]?.max ?? 0)
  } catch {
    return 0
  }
}

/** Kiểm tra ai_portal schema có tồn tại không */
async function hasAiPortalSchema(): Promise<boolean> {
  try {
    const r = await query<{ cnt: string }>(
      "SELECT COUNT(*)::text AS cnt FROM information_schema.schemata WHERE schema_name = 'ai_portal'"
    )
    return Number(r.rows[0]?.cnt ?? 0) > 0
  } catch {
    return false
  }
}

/** Chạy file SQL bằng psql */
function runSqlFile(dbName: string, sqlPath: string, sql?: string): { ok: boolean; stderr?: string } {
  const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
  const port = getBootstrapEnv("POSTGRES_PORT", "5432")
  const user = getBootstrapEnv("POSTGRES_USER", "postgres")
  const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"
  const args = ["-h", host, "-p", String(port), "-d", dbName, "-U", user, "-v", "ON_ERROR_STOP=1"]
  if (sql) {
    const tmpFile = path.join(os.tmpdir(), `aiportal-migrate-${Date.now()}.sql`)
    fs.writeFileSync(tmpFile, sql, "utf8")
    try {
      const result = spawnSync("psql", [...args, "-f", tmpFile], {
        encoding: "utf8",
        env: { ...process.env, PGPASSWORD: password },
        timeout: 60_000,
      })
      return { ok: result.status === 0, stderr: result.stderr || result.stdout }
    } finally {
      try {
        fs.unlinkSync(tmpFile)
      } catch {}
    }
  }
  const result = spawnSync("psql", [...args, "-f", sqlPath], {
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: password },
    timeout: 60_000,
  })
  return { ok: result.status === 0, stderr: result.stderr || result.stdout }
}

/**
 * Chạy migration 001_create_enums.sql (tạo types trong public).
 * Gọi trước khi restore vì pg_dump -n ai_portal không dump types.
 */
export function runPrerequisiteMigration(dbName: string): { ok: boolean; stderr?: string } {
  const p = path.join(MIGRATIONS_DIR, PREREQ_MIGRATION)
  if (!fs.existsSync(p)) {
    return { ok: true }
  }
  return runSqlFile(dbName, p)
}

/**
 * Chạy các migrations chưa áp dụng để đưa DB lên phiên bản mới nhất.
 */
export async function runMigrations(): Promise<{ ok: boolean; message?: string }> {
  const dbName = getDatabaseName()
  if (dbName === "postgres") {
    return { ok: true }
  }

  const hasSchema = await hasAiPortalSchema()
  if (!hasSchema) {
    return { ok: true }
  }

  const currentVersion = await getCurrentVersion()
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))
  const toRun: { version: number; file: string }[] = []

  for (const file of files) {
    const m = file.match(SCHEMA_MIGRATIONS)
    if (!m || file === PREREQ_MIGRATION) continue
    const version = parseInt(m[1], 10)
    if (version > currentVersion) {
      toRun.push({ version, file })
    }
  }
  toRun.sort((a, b) => a.version - b.version)

  for (const { version, file } of toRun) {
    const sqlPath = path.join(MIGRATIONS_DIR, file)
    const { ok, stderr } = runSqlFile(dbName, sqlPath)
    if (!ok) {
      return { ok: false, message: `Migration ${file} failed: ${stderr}` }
    }
    await query(
      "INSERT INTO ai_portal.schema_version (version, applied_at) VALUES ($1, now()) ON CONFLICT (version) DO NOTHING",
      [version]
    )
  }

  return { ok: true }
}
