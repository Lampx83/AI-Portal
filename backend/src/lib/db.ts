// lib/db.ts
// Postgres connection uses env only (bootstrap), does not read from DB.
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
  // No setup-db.json yet (during setup): use "postgres" so backend can still run without crashing
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
      max: Math.max(1, Math.min(100, Number(getBootstrapEnv("POSTGRES_POOL_MAX", "20")))),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    // Avoid crash when Postgres disconnects (e.g. restart, 57P01). Node throws if pool emits 'error' with no listener.
    poolInstance.on("error", (err) => {
      console.error("[db] Pool error (connection lost/terminated):", err.message)
    })
  }
  return poolInstance
}

/** Call after setup writes setup-db.json so backend uses the correct database. */
export function resetPool(): void {
  if (poolInstance) {
    poolInstance.end().catch(() => {})
    poolInstance = null
  }
}

/** Graceful shutdown: đóng pool và đợi kết nối trả về. Gọi trước process.exit. */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    const p = poolInstance
    poolInstance = null
    await p.end().catch(() => {})
  }
}

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

// Helper to run a transaction with the same client
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
