/**
 * System backup: PostgreSQL (full DB dump) + MinIO + data/setup-*.json
 * GET /api/admin/backup/create → download .zip file
 * POST /api/admin/backup/restore → restore from .zip file (admin only)
 * GET/PATCH /api/admin/backup/schedule → periodic backup config
 */
import { Router, Request, Response } from "express"
import path from "path"
import fs from "fs"
import multer from "multer"
import { spawnSync } from "child_process"
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import AdmZip from "adm-zip"
import { getDatabaseName, query } from "../../lib/db"
import { getSetting, getBootstrapEnv } from "../../lib/settings"
import { adminOnly } from "./middleware"
import { runRestore, RestoreError } from "../../lib/restore-backup"
import { loadRuntimeConfigFromDb } from "../../lib/runtime-config"
import { remountAllBundledApps } from "../../lib/mounted-apps"
import { getDataDir } from "../../lib/paths"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } }) // 512MB max
const DATA_DIR = getDataDir()
const SCHEDULE_KEYS = [
  "backup_schedule_enabled",
  "backup_schedule_interval_hours",
  "backup_schedule_dir",
  "backup_schedule_include_minio",
] as const
const DEFAULT_SCHEDULE_INTERVAL_HOURS = 24
const DEFAULT_SCHEDULE_DIR = path.join(DATA_DIR, "backups")

type BackupScheduleConfig = {
  enabled: boolean
  intervalHours: number
  backupDir: string
  includeMinio: boolean
  lastRunAt: string | null
}

let scheduleTimer: NodeJS.Timeout | null = null
let scheduleLastRunAt: string | null = null

function getS3Config() {
  const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
  const port = getSetting("MINIO_PORT", "9000")
  const region = getSetting("AWS_REGION", "us-east-1")
  const accessKey = getSetting("MINIO_ACCESS_KEY")
  const secretKey = getSetting("MINIO_SECRET_KEY")
  const bucket = getSetting("MINIO_BUCKET_NAME", "portal")
  return { endpoint, port, region, accessKey, secretKey, bucket }
}

function getS3Client(): S3Client {
  const { endpoint, port, region, accessKey, secretKey } = getS3Config()
  return new S3Client({
    endpoint: `http://${endpoint}:${port}`,
    region,
    credentials: { accessKeyId: accessKey || "", secretAccessKey: secretKey || "" },
    forcePathStyle: true,
  })
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (normalized === "true" || normalized === "1") return true
    if (normalized === "false" || normalized === "0") return false
  }
  return fallback
}

function normalizeBackupDir(raw: unknown): string {
  const candidate = typeof raw === "string" ? raw.trim() : ""
  if (!candidate) return DEFAULT_SCHEDULE_DIR
  return path.resolve(candidate)
}

async function loadScheduleConfigFromDb(): Promise<BackupScheduleConfig> {
  try {
    const result = await query<{ key: string; value: string }>(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [SCHEDULE_KEYS as unknown as string[]]
    )
    const map = Object.fromEntries(result.rows.map((r) => [r.key, r.value]))
    const intervalRaw = Number.parseInt(String(map.backup_schedule_interval_hours ?? DEFAULT_SCHEDULE_INTERVAL_HOURS), 10)
    const intervalHours =
      Number.isInteger(intervalRaw) && intervalRaw >= 1 && intervalRaw <= 168 ? intervalRaw : DEFAULT_SCHEDULE_INTERVAL_HOURS
    return {
      enabled: toBoolean(map.backup_schedule_enabled, false),
      intervalHours,
      backupDir: normalizeBackupDir(map.backup_schedule_dir),
      includeMinio: toBoolean(map.backup_schedule_include_minio, true),
      lastRunAt: scheduleLastRunAt,
    }
  } catch (err: any) {
    console.warn("[backup] loadScheduleConfigFromDb failed:", err?.message || err)
    return {
      enabled: false,
      intervalHours: DEFAULT_SCHEDULE_INTERVAL_HOURS,
      backupDir: DEFAULT_SCHEDULE_DIR,
      includeMinio: true,
      lastRunAt: scheduleLastRunAt,
    }
  }
}

async function saveScheduleConfigToDb(config: BackupScheduleConfig): Promise<void> {
  await query(
    `INSERT INTO ai_portal.app_settings (key, value) VALUES
      ('backup_schedule_enabled', $1),
      ('backup_schedule_interval_hours', $2),
      ('backup_schedule_dir', $3),
      ('backup_schedule_include_minio', $4)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [
      config.enabled ? "true" : "false",
      String(config.intervalHours),
      config.backupDir,
      config.includeMinio ? "true" : "false",
    ]
  )
}

function nowStampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
}

async function buildSystemBackupZip(options?: {
  includeMinio?: boolean
}): Promise<{ zipBuffer: Buffer; filename: string; manifest: Record<string, unknown> }> {
  const includeMinio = options?.includeMinio !== false
  const dbName = getDatabaseName()
  if (dbName === "postgres") {
    throw new RestoreError("Chưa có database được cấu hình. Hoàn thành setup (khởi tạo database) trước khi backup.", 400)
  }

  const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
  const port = getBootstrapEnv("POSTGRES_PORT", "5432")
  const user = getBootstrapEnv("POSTGRES_USER", "postgres")
  const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"

  // Dump full database so all configurations/schemas are included.
  const pgDump = spawnSync(
    "pg_dump",
    ["-h", host, "-p", String(port), "-U", user, "-d", dbName, "--no-owner", "--no-acl"],
    { encoding: "utf8", env: { ...process.env, PGPASSWORD: password }, timeout: 300_000, maxBuffer: 200 * 1024 * 1024 }
  )
  if (pgDump.error) {
    throw new RestoreError("Không chạy được pg_dump. Cần cài PostgreSQL client (pg_dump). " + pgDump.error.message, 503)
  }
  if (pgDump.status !== 0) {
    throw new RestoreError("Lỗi khi dump database: " + (pgDump.stderr || pgDump.stdout || String(pgDump.status)), 500)
  }
  const databaseSql = pgDump.stdout || ""

  const zip = new AdmZip()
  zip.addFile("database.sql", Buffer.from(databaseSql, "utf8"))

  const dataFiles = ["setup-branding.json", "setup-db.json", "setup-language.json"]
  for (const name of dataFiles) {
    const filePath = path.join(DATA_DIR, name)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf8")
      zip.addFile(`data/${name}`, Buffer.from(content, "utf8"))
    }
  }

  let minioKeyCount = 0
  const { bucket } = getS3Config()
  if (includeMinio && bucket && getSetting("MINIO_ENDPOINT") && getSetting("MINIO_PORT")) {
    try {
      const s3 = getS3Client()
      let continuationToken: string | undefined
      do {
        const listCmd = new ListObjectsV2Command({
          Bucket: bucket,
          MaxKeys: 500,
          ContinuationToken: continuationToken,
        })
        const listRes = await s3.send(listCmd)
        const contents = listRes.Contents || []
        for (const obj of contents) {
          const key = obj.Key
          if (!key) continue
          const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key })
          const getRes = await s3.send(getCmd)
          const body = getRes.Body
          if (body) {
            const buf = await streamToBuffer(body as Readable)
            zip.addFile(`minio/${key}`, buf)
            minioKeyCount++
          }
        }
        continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
      } while (continuationToken)
    } catch (err: any) {
      console.error("Backup MinIO error (continuing without MinIO):", err?.message || err)
    }
  }

  const manifest = {
    version: 2,
    databaseName: dbName,
    createdAt: new Date().toISOString(),
    includeMinio,
    minioKeyCount,
    scope: "full_database",
  }
  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"))

  const zipBuffer = zip.toBuffer()
  const filename = `${dbName}-backup-${nowStampForFilename()}.zip`
  return { zipBuffer, filename, manifest }
}

async function runScheduledBackupOnce(config: BackupScheduleConfig): Promise<void> {
  if (!config.enabled) return
  const backupDir = normalizeBackupDir(config.backupDir)
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
  const { zipBuffer, filename } = await buildSystemBackupZip({ includeMinio: config.includeMinio })
  const outPath = path.join(backupDir, filename)
  fs.writeFileSync(outPath, zipBuffer)
  scheduleLastRunAt = new Date().toISOString()
  console.log("[backup] periodic backup saved:", outPath)
}

async function refreshScheduleTimer(): Promise<void> {
  if (scheduleTimer) {
    clearInterval(scheduleTimer)
    scheduleTimer = null
  }
  const config = await loadScheduleConfigFromDb()
  if (!config.enabled) return
  const ms = config.intervalHours * 60 * 60 * 1000
  scheduleTimer = setInterval(() => {
    runScheduledBackupOnce(config).catch((err: any) => {
      console.warn("[backup] periodic backup failed:", err?.message || err)
    })
  }, ms)
  console.log(
    `[backup] periodic backup enabled: every ${config.intervalHours}h to ${config.backupDir} (minio=${config.includeMinio})`
  )
}

/**
 * GET /api/admin/backup/create
 * Create backup .zip containing: manifest.json, database.sql, data/*.json, optional minio/* (objects)
 * Query:
 * - includeMinio=true|false (default true)
 */
router.get("/create", adminOnly, async (req: Request, res: Response) => {
  try {
    const includeMinio = toBoolean(req.query.includeMinio, true)
    const { zipBuffer, filename } = await buildSystemBackupZip({ includeMinio })
    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", String(zipBuffer.length))
    res.send(zipBuffer)
  } catch (err: any) {
    console.error("GET /api/admin/backup/create error:", err)
    if (err instanceof RestoreError) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    res.status(500).json({
      error: "Lỗi tạo backup",
      message: err?.message ?? String(err),
    })
  }
})

/**
 * GET /api/admin/backup/schedule
 */
router.get("/schedule", adminOnly, async (_req: Request, res: Response) => {
  try {
    const config = await loadScheduleConfigFromDb()
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: "Lỗi lấy cấu hình backup định kỳ", message: err?.message ?? String(err) })
  }
})

/**
 * PATCH /api/admin/backup/schedule
 * Body: { enabled, intervalHours, backupDir, includeMinio }
 */
router.patch("/schedule", adminOnly, async (req: Request, res: Response) => {
  try {
    const current = await loadScheduleConfigFromDb()
    const next: BackupScheduleConfig = {
      enabled: req.body?.enabled !== undefined ? toBoolean(req.body.enabled, current.enabled) : current.enabled,
      intervalHours:
        req.body?.intervalHours !== undefined
          ? Math.max(1, Math.min(168, Number.parseInt(String(req.body.intervalHours), 10) || DEFAULT_SCHEDULE_INTERVAL_HOURS))
          : current.intervalHours,
      backupDir: req.body?.backupDir !== undefined ? normalizeBackupDir(req.body.backupDir) : current.backupDir,
      includeMinio:
        req.body?.includeMinio !== undefined ? toBoolean(req.body.includeMinio, current.includeMinio) : current.includeMinio,
      lastRunAt: scheduleLastRunAt,
    }
    if (!fs.existsSync(next.backupDir)) fs.mkdirSync(next.backupDir, { recursive: true })
    await saveScheduleConfigToDb(next)
    await refreshScheduleTimer()
    res.json(next)
  } catch (err: any) {
    res.status(500).json({ error: "Lỗi lưu cấu hình backup định kỳ", message: err?.message ?? String(err) })
  }
})

/**
 * POST /api/admin/backup/schedule/run-now
 */
router.post("/schedule/run-now", adminOnly, async (_req: Request, res: Response) => {
  try {
    const config = await loadScheduleConfigFromDb()
    await runScheduledBackupOnce({ ...config, enabled: true })
    res.json({ ok: true, lastRunAt: scheduleLastRunAt })
  } catch (err: any) {
    res.status(500).json({ error: "Lỗi chạy backup định kỳ", message: err?.message ?? String(err) })
  }
})

/**
 * POST /api/admin/backup/restore
 * Restore from backup .zip (same logic as /api/setup/restore). Admin only.
 */
router.post("/restore", adminOnly, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: "Chưa chọn file backup. Gửi file .zip với field 'file'." })
    }
    await runRestore(file.buffer)
    await loadRuntimeConfigFromDb().catch((e) => console.warn("[restore] loadRuntimeConfigFromDb failed:", e?.message))
    await remountAllBundledApps(req.app).catch((e) => console.warn("[restore] remountAllBundledApps failed:", e?.message))
    res.json({
      ok: true,
      message: "Đã khôi phục backup. Hệ thống đã về trạng thái tại thời điểm backup. Bạn có thể đăng nhập và sử dụng bình thường.",
    })
  } catch (err: any) {
    console.error("POST /api/admin/backup/restore error:", err)
    if (err instanceof RestoreError) {
      return res.status(err.statusCode).json({ error: err.message })
    }
    res.status(500).json({
      error: "Lỗi khôi phục backup",
      message: err?.message ?? String(err),
    })
  }
})

// Start periodic backup timer on server boot (safe to call before DB ready).
setTimeout(() => {
  refreshScheduleTimer().catch((err: any) => {
    console.warn("[backup] initial schedule setup failed:", err?.message || err)
  })
}, 1_000)

export default router
