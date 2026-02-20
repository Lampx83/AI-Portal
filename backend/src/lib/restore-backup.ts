/**
 * Shared logic to restore system from backup .zip (used by /api/setup/restore and /api/admin/backup/restore).
 */
import path from "path"
import fs from "fs"
import os from "os"
import { spawnSync } from "child_process"
import { Pool, QueryResultRow } from "pg"
import AdmZip from "adm-zip"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getBootstrapEnv, getSetting } from "./settings"
import { resetPool } from "./db"

const BACKEND_ROOT = path.join(__dirname, "..", "..")
const DATA_DIR = path.join(BACKEND_ROOT, "data")
const SETUP_DB_FILE = path.join(DATA_DIR, "setup-db.json")
const MAINTENANCE_DB = "postgres"

const isTrue = (v?: string) => String(v).toLowerCase() === "true"

export class RestoreError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = "RestoreError"
  }
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

async function databaseExists(dbName: string): Promise<boolean> {
  const p = new Pool({
    host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
    port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
    database: MAINTENANCE_DB,
    user: getBootstrapEnv("POSTGRES_USER", "postgres"),
    password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres",
    ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
  })
  try {
    const client = await p.connect()
    try {
      const r = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName])
      return r.rows.length > 0
    } finally {
      client.release()
    }
  } finally {
    await p.end()
  }
}

async function queryWithDb<T extends QueryResultRow = QueryResultRow>(
  database: string,
  text: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  const p = new Pool({
    host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
    port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
    database,
    user: getBootstrapEnv("POSTGRES_USER", "postgres"),
    password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres",
    ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 10_000,
  })
  try {
    const client = await p.connect()
    try {
      const result = await client.query<T>(text, params)
      return { rows: result.rows }
    } finally {
      client.release()
    }
  } finally {
    await p.end()
  }
}

/**
 * Restore system from backup .zip buffer. Throws RestoreError with statusCode 400/503/500 on failure.
 */
export async function runRestore(buffer: Buffer): Promise<void> {
  if (!buffer || buffer.length === 0) {
    throw new RestoreError("Chưa chọn file backup. Gửi file .zip với field 'file'.", 400)
  }
  const zip = new AdmZip(buffer)
  const manifestEntry = zip.getEntry("manifest.json")
  if (!manifestEntry || manifestEntry.isDirectory) {
    throw new RestoreError("File backup không hợp lệ: thiếu manifest.json.", 400)
  }
  const manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as {
    version?: number
    databaseName?: string
    createdAt?: string
    minioKeyCount?: number
  }
  const dbName =
    typeof manifest.databaseName === "string" && manifest.databaseName.trim()
      ? manifest.databaseName.trim()
      : null
  if (!dbName || !/^[a-z0-9_]{1,63}$/.test(dbName)) {
    throw new RestoreError("File backup không hợp lệ: databaseName trong manifest không hợp lệ.", 400)
  }

  const dbExists = await databaseExists(dbName)
  if (!dbExists) {
    const poolDefault = new Pool({
      host: getBootstrapEnv("POSTGRES_HOST", "localhost"),
      port: Number(getBootstrapEnv("POSTGRES_PORT", "5432")),
      database: MAINTENANCE_DB,
      user: getBootstrapEnv("POSTGRES_USER", "postgres"),
      password: getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres",
      ssl: isTrue(getBootstrapEnv("POSTGRES_SSL")) ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10_000,
    })
    try {
      const client = await poolDefault.connect()
      try {
        await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`)
      } finally {
        client.release()
      }
    } finally {
      await poolDefault.end()
    }
  }

  await queryWithDb(dbName, "DROP SCHEMA IF EXISTS ai_portal CASCADE")

  const dbSqlEntry = zip.getEntry("database.sql")
  if (!dbSqlEntry || dbSqlEntry.isDirectory) {
    throw new RestoreError("File backup không hợp lệ: thiếu database.sql.", 400)
  }
  let sqlContent = dbSqlEntry.getData().toString("utf8")
  // pg_dump from PostgreSQL 17+ may emit SET transaction_timeout; strip so restore works on PG 16 and older
  sqlContent = sqlContent
    .split("\n")
    .filter((line) => {
      const t = line.trim()
      if (!t.toUpperCase().startsWith("SET ")) return true
      return !/transaction_timeout/i.test(t)
    })
    .join("\n")
  const sqlPath = path.join(os.tmpdir(), `aiportal-restore-${Date.now()}.sql`)
  fs.writeFileSync(sqlPath, sqlContent, "utf8")
  try {
    const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
    const port = getBootstrapEnv("POSTGRES_PORT", "5432")
    const user = getBootstrapEnv("POSTGRES_USER", "postgres")
    const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"
    const result = spawnSync(
      "psql",
      ["-h", host, "-p", String(port), "-d", dbName, "-U", user, "-f", sqlPath, "-v", "ON_ERROR_STOP=1"],
      { encoding: "utf8", env: { ...process.env, PGPASSWORD: password }, timeout: 300_000 }
    )
    if (result.error) {
      throw new RestoreError(
        "Không chạy được psql để khôi phục database. " + result.error.message,
        503
      )
    }
    if (result.status !== 0) {
      throw new RestoreError(
        "Lỗi khi chạy SQL khôi phục: " + (result.stderr || result.stdout || String(result.status)),
        500
      )
    }
  } finally {
    try {
      fs.unlinkSync(sqlPath)
    } catch {}
  }

  ensureDataDir()
  fs.writeFileSync(SETUP_DB_FILE, JSON.stringify({ databaseName: dbName }, null, 2), "utf8")
  const dataFiles = ["setup-branding.json", "setup-db.json", "setup-language.json"] as const
  for (const name of dataFiles) {
    const entry = zip.getEntry(`data/${name}`)
    if (entry && !entry.isDirectory) {
      fs.writeFileSync(path.join(DATA_DIR, name), entry.getData(), "utf8")
    }
  }
  resetPool()

  const bucket = getSetting("MINIO_BUCKET_NAME", "portal")
  const minioEndpoint = getSetting("MINIO_ENDPOINT", "localhost")
  const minioPort = getSetting("MINIO_PORT", "9000")
  const accessKey = getSetting("MINIO_ACCESS_KEY")
  const secretKey = getSetting("MINIO_SECRET_KEY")
  const region = getSetting("AWS_REGION", "us-east-1")
  if (bucket && minioEndpoint && minioPort && accessKey && secretKey) {
    const s3 = new S3Client({
      endpoint: `http://${minioEndpoint}:${minioPort}`,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    })
    const entries = zip.getEntries()
    for (const entry of entries) {
      const name = entry.entryName
      if (name.startsWith("minio/") && !entry.isDirectory) {
        const key = name.slice("minio/".length)
        if (!key) continue
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: entry.getData(),
            ContentType: "application/octet-stream",
          })
        )
      }
    }
  }
}
