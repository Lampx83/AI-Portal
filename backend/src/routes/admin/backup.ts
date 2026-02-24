/**
 * System backup: PostgreSQL (schema ai_portal) + MinIO + data/setup-*.json
 * GET /api/admin/backup/create → download .zip file
 * POST /api/admin/backup/restore → restore from .zip file (admin only)
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

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } }) // 512MB max
const BACKEND_ROOT = path.join(__dirname, "..", "..", "..")
const DATA_DIR = path.join(BACKEND_ROOT, "data")

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

/**
 * GET /api/admin/backup/create
 * Create backup .zip containing: manifest.json, database.sql, data/*.json, minio/* (objects)
 */
router.get("/create", adminOnly, async (req: Request, res: Response) => {
  try {
    const dbName = getDatabaseName()
    if (dbName === "postgres") {
      return res.status(400).json({
        error: "Chưa có database được cấu hình. Hoàn thành setup (khởi tạo database) trước khi backup.",
      })
    }

    const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
    const port = getBootstrapEnv("POSTGRES_PORT", "5432")
    const user = getBootstrapEnv("POSTGRES_USER", "postgres")
    const password = getBootstrapEnv("POSTGRES_PASSWORD", "postgres") || "postgres"

    // Schema app (annota, writium) chỉ dump nếu tồn tại
    const appSchemaRes = await query<{ schema_name: string }>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('annota','writium','quantis')"
    )
    const appSchemas = (appSchemaRes.rows || []).map((r) => r.schema_name)
    const schemaArgs = ["-n", "ai_portal", ...appSchemas.flatMap((s) => ["-n", s])]

    // 1. pg_dump schema ai_portal + schema app (nếu có)
    const pgDump = spawnSync(
      "pg_dump",
      ["-h", host, "-p", String(port), "-U", user, "-d", dbName, ...schemaArgs, "--no-owner", "--no-acl"],
      { encoding: "utf8", env: { ...process.env, PGPASSWORD: password }, timeout: 300_000, maxBuffer: 50 * 1024 * 1024 }
    )
    if (pgDump.error) {
      return res.status(503).json({
        error: "Không chạy được pg_dump. Cần cài PostgreSQL client (pg_dump).",
        message: pgDump.error.message,
      })
    }
    if (pgDump.status !== 0) {
      return res.status(500).json({
        error: "Lỗi khi dump database",
        message: pgDump.stderr || pgDump.stdout || String(pgDump.status),
      })
    }
    const databaseSql = pgDump.stdout || ""

    const zip = new AdmZip()
    zip.addFile("database.sql", Buffer.from(databaseSql, "utf8"))

    // 2. Data files (setup-*.json)
    const dataFiles = ["setup-branding.json", "setup-db.json", "setup-language.json"]
    for (const name of dataFiles) {
      const filePath = path.join(DATA_DIR, name)
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf8")
        zip.addFile(`data/${name}`, Buffer.from(content, "utf8"))
      }
    }

    // 3. MinIO: list all objects, download each, add to zip under minio/
    let minioKeyCount = 0
    const { bucket } = getS3Config()
    if (bucket && getSetting("MINIO_ENDPOINT") && getSetting("MINIO_PORT")) {
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
              // Zip entry name: minio/<key> (key may contain /)
              zip.addFile(`minio/${key}`, buf)
              minioKeyCount++
            }
          }
          continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined
        } while (continuationToken)
      } catch (err: any) {
        console.error("Backup MinIO error (continuing without MinIO):", err?.message || err)
        // Still return backup with DB + data; MinIO might be down or not configured
      }
    }

    const manifest = {
      version: 1,
      databaseName: dbName,
      createdAt: new Date().toISOString(),
      minioKeyCount,
    }
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf8"))

    const zipBuffer = zip.toBuffer()
    const filename = `aiportal-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.zip`
    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    res.setHeader("Content-Length", String(zipBuffer.length))
    res.send(zipBuffer)
  } catch (err: any) {
    console.error("GET /api/admin/backup/create error:", err)
    res.status(500).json({
      error: "Lỗi tạo backup",
      message: err?.message ?? String(err),
    })
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

export default router
