// lib/db.ts
// Kết nối Postgres chỉ dùng biến môi trường (bootstrap), không đọc từ DB.
import "./env"
import path from "path"
import fs from "fs"
import { Pool, QueryResultRow } from "pg"
import { getBootstrapEnv } from "./settings"

const isTrue = (v?: string) => String(v).toLowerCase() === "true"

const DATA_DIR = path.join(__dirname, "..", "..", "data")
const SETUP_DB_FILE = path.join(DATA_DIR, "setup-db.json")

export function getDatabaseName(): string {
  try {
    if (fs.existsSync(SETUP_DB_FILE)) {
      const raw = fs.readFileSync(SETUP_DB_FILE, "utf8")
      const data = JSON.parse(raw) as { databaseName?: string }
      if (typeof data.databaseName === "string" && data.databaseName.trim()) {
        return data.databaseName.trim()
      }
    }
  } catch {}
  // Chưa có setup-db.json (đang setup): dùng "postgres" để backend vẫn chạy được, không crash vì DB chưa tạo
  return "postgres"
}

let poolInstance: Pool | null = null

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
      port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
      database: getDatabaseName(),
      user: getBootstrapEnv("POSTGRES_USER", "postgres"),
      password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres"),
      ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return poolInstance
}

/** Gọi sau khi setup ghi setup-db.json để backend dùng đúng database. */
export function resetPool(): void {
  if (poolInstance) {
    poolInstance.end().catch(() => {})
    poolInstance = null
  }
}

export const pool = new Proxy({} as Pool, {
  get(_, prop) {
    return (getPool() as any)[prop]
  },
})

const STATEMENT_TIMEOUT_MS = 30_000

export async function query<T extends QueryResultRow = any>(text: string, params?: any[]) {
  const client = await getPool().connect().catch((err) => {
    throw err
  })
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    return await client.query<T>(text, params)
  } catch (err) {
    throw err
  } finally {
    client.release()
  }
}

// Helper function để chạy transaction với cùng một client
export async function withTransaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await getPool().connect().catch((err) => {
    throw err
  })
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    await client.query("BEGIN")
    try {
      const result = await callback(client)
      await client.query("COMMIT")
      return result
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    }
  } finally {
    client.release()
  }
}
