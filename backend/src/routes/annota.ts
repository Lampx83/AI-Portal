/**
 * Annota API: file lưu MinIO (prefix annota/{userId}/), metadata + text trong DB.
 * Tất cả route yêu cầu đăng nhập (session).
 */
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import multer from "multer"
import crypto from "crypto"
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import { Readable } from "stream"
import { query } from "../lib/db"
import { getSetting } from "../lib/settings"
import { getBootstrapEnv } from "../lib/settings"
import { parseCookies } from "../lib/parse-cookies"

/** Schema riêng cho app Annota khi cài vào Portal (không dùng chung ai_portal). Có thể set env APP_ANNOTA_SCHEMA=ai_portal để tương thích cũ. */
const ANNOTA_SCHEMA = (getBootstrapEnv("APP_ANNOTA_SCHEMA") || "annota").replace(/[^a-z0-9_]/gi, "") || "annota"

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB

function paramStr(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] ?? "" : p ?? ""
}

async function getCurrentUserId(req: Request): Promise<string | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

function requireAuth(req: Request, res: Response, next: () => void) {
  getCurrentUserId(req).then((userId) => {
    if (!userId) {
      res.status(401).json({ error: "Chưa đăng nhập" })
      return
    }
    ;(req as any).annotaUserId = userId
    next()
  })
}

router.use(requireAuth)

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

/** Extract text from buffer by mime/filename (PDF, TXT, etc.) */
async function extractTextFromBuffer(buf: Buffer, filename: string, mimeType: string): Promise<string> {
  const ext = (filename.split(".").pop() || "").toLowerCase()
  if (mimeType === "text/plain" || ext === "txt" || ext === "md" || ext === "csv") {
    return buf.toString("utf-8")
  }
  if (mimeType === "application/pdf" || ext === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default
      const data = await pdfParse(buf)
      return (data?.text ?? "").trim()
    } catch (e: any) {
      console.warn("pdf-parse error:", e?.message)
      return ""
    }
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === "docx") {
    try {
      const mammoth = await import("mammoth")
      const result = await mammoth.default.extractRawText({ buffer: buf })
      return (result?.value ?? "").trim()
    } catch (e: any) {
      console.warn("mammoth error:", e?.message)
      return ""
    }
  }
  return ""
}

/**
 * POST /api/annota/upload
 * Upload file to MinIO: annota/{userId}/{hash}{ext}. Returns key, downloadUrl, extractedText, fileName, fileSize.
 */
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).annotaUserId as string
    const file = req.file
    if (!file || !file.buffer?.length) {
      return res.status(400).json({ error: "Không có file" })
    }

    const bucket = getS3Config().bucket
    const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
    const port = getSetting("MINIO_PORT", "9000")
    const endpointPublic = getSetting("MINIO_ENDPOINT_PUBLIC") || endpoint

    const hash = crypto.createHash("sha256").update(file.buffer).digest("hex")
    const parts = (file.originalname || "file").split(".")
    const ext = parts.length > 1 ? "." + parts.pop()!.toLowerCase() : ""
    const key = `annota/${userId}/${hash}${ext}`

    const s3 = getS3Client()

    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    } catch {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        })
      )
    }

    const extractedText = await extractTextFromBuffer(file.buffer, file.originalname || "", file.mimetype || "")
    const baseUrl = `http://${endpointPublic}:${port}/${bucket}`
    const downloadUrl = `${baseUrl}/${key}`

    res.json({
      key,
      downloadUrl,
      extractedText,
      fileName: file.originalname || "file",
      fileSize: file.size,
      mimeType: file.mimetype || "application/octet-stream",
    })
  } catch (err: any) {
    console.error("❌ Annota upload error:", err)
    res.status(500).json({ error: err?.message || "Upload thất bại" })
  }
})

/**
 * GET /api/annota/files
 * List files for current user (prefix annota/{userId}/)
 */
router.get("/files", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).annotaUserId as string
    const prefix = `annota/${userId}/`
    const s3 = getS3Client()
    const bucket = getS3Config().bucket

    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 500,
      })
    )

    const objects = (list.Contents || []).map((obj) => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || null,
    }))

    res.json({ files: objects })
  } catch (err: any) {
    console.error("❌ Annota list files error:", err)
    res.status(500).json({ error: err?.message || "Lỗi danh sách file" })
  }
})

/**
 * GET /api/annota/download/:key(*)
 * Download file; key must start with annota/{userId}/
 */
router.get("/download/:key(*)", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).annotaUserId as string
    const key = decodeURIComponent(paramStr(req.params.key))
    const expectedPrefix = `annota/${userId}/`
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({ error: "Không có quyền truy cập file này" })
    }

    const s3 = getS3Client()
    const bucket = getS3Config().bucket
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))

    const contentType = response.ContentType || "application/octet-stream"
    const filename = key.split("/").pop() || "file"
    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)
    if (response.ContentLength) res.setHeader("Content-Length", String(response.ContentLength))

    if (response.Body instanceof Readable) {
      response.Body.pipe(res)
    } else if (response.Body) {
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) chunks.push(chunk)
      res.send(Buffer.concat(chunks))
    } else {
      res.status(404).json({ error: "File trống" })
    }
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: "File không tồn tại" })
    }
    console.error("❌ Annota download error:", err)
    res.status(500).json({ error: err?.message || "Tải file thất bại" })
  }
})

/**
 * DELETE /api/annota/file/:key(*)
 * Delete file; key must start with annota/{userId}/
 */
router.delete("/file/:key(*)", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).annotaUserId as string
    const key = decodeURIComponent(paramStr(req.params.key))
    const expectedPrefix = `annota/${userId}/`
    if (!key.startsWith(expectedPrefix)) {
      return res.status(403).json({ error: "Không có quyền xóa file này" })
    }

    const s3 = getS3Client()
    const bucket = getS3Config().bucket
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    res.json({ status: "success" })
  } catch (err: any) {
    console.error("❌ Annota delete file error:", err)
    res.status(500).json({ error: err?.message || "Xóa file thất bại" })
  }
})

// --- Data CRUD (folders, sources, nodes, codes, memos) ---

/**
 * GET /api/annota/data
 * Returns { folders, sources, nodes, codes, memos } for current user.
 */
router.get("/data", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).annotaUserId as string

    const [folders, sources, nodes, codes, memos] = await Promise.all([
      query(`SELECT id, name, parent_id AS "parentId", created_at AS "createdAt" FROM ${ANNOTA_SCHEMA}.annota_folders WHERE user_id = $1::uuid ORDER BY created_at`, [userId]),
      query(`SELECT id, name, content, folder_id AS "folderId", metadata, type, file_key AS "fileKey", file_name AS "fileName", file_size AS "fileSize", created_at AS "createdAt" FROM ${ANNOTA_SCHEMA}.annota_sources WHERE user_id = $1::uuid ORDER BY created_at`, [userId]),
      query(`SELECT id, name, parent_id AS "parentId", description, color, created_at AS "createdAt" FROM ${ANNOTA_SCHEMA}.annota_nodes WHERE user_id = $1::uuid ORDER BY created_at`, [userId]),
      query(`SELECT id, source_id AS "sourceId", node_id AS "nodeId", start, "end", excerpt, created_at AS "createdAt", weight, coder_id AS "coderId", flag FROM ${ANNOTA_SCHEMA}.annota_codes WHERE user_id = $1::uuid ORDER BY created_at`, [userId]),
      query(`SELECT id, title, content, source_id AS "sourceId", node_id AS "nodeId", created_at AS "createdAt", updated_at AS "updatedAt" FROM ${ANNOTA_SCHEMA}.annota_memos WHERE user_id = $1::uuid ORDER BY created_at`, [userId]),
    ])

    res.json({
      folders: folders.rows,
      sources: sources.rows,
      nodes: nodes.rows,
      codes: codes.rows,
      memos: memos.rows,
    })
  } catch (err: any) {
    console.error("❌ Annota GET data error:", err)
    res.status(500).json({ error: err?.message || "Lỗi tải dữ liệu" })
  }
})

/**
 * POST /api/annota/data
 * Body: { folders?, sources?, nodes?, codes?, memos? } — full replace for each array (sync from client).
 */
router.post("/data", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).annotaUserId as string
    const body = req.body || {}

    if (Array.isArray(body.folders)) {
      await query(`DELETE FROM ${ANNOTA_SCHEMA}.annota_folders WHERE user_id = $1::uuid`, [userId])
      for (const f of body.folders) {
        await query(
          `INSERT INTO ${ANNOTA_SCHEMA}.annota_folders (id, user_id, name, parent_id, created_at) VALUES ($1, $2::uuid, $3, $4, $5::timestamptz) ON CONFLICT (id) DO UPDATE SET name = $3, parent_id = $4`,
          [f.id, userId, f.name || "", f.parentId ?? null, f.createdAt || new Date().toISOString()]
        )
      }
    }
    if (Array.isArray(body.sources)) {
      await query(`DELETE FROM ${ANNOTA_SCHEMA}.annota_sources WHERE user_id = $1::uuid`, [userId])
      for (const s of body.sources) {
        await query(
          `INSERT INTO ${ANNOTA_SCHEMA}.annota_sources (id, user_id, name, content, folder_id, metadata, type, file_key, file_name, file_size, created_at) VALUES ($1, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::timestamptz) ON CONFLICT (id) DO UPDATE SET name = $3, content = $4, folder_id = $5, metadata = $6::jsonb, type = $7, file_key = $8, file_name = $9, file_size = $10`,
          [
            s.id,
            userId,
            s.name || "",
            s.content ?? "",
            s.folderId ?? null,
            JSON.stringify(s.metadata || {}),
            s.type || "text",
            s.fileKey ?? null,
            s.fileName ?? null,
            s.fileSize ?? null,
            s.createdAt || new Date().toISOString(),
          ]
        )
      }
    }
    if (Array.isArray(body.nodes)) {
      await query(`DELETE FROM ${ANNOTA_SCHEMA}.annota_nodes WHERE user_id = $1::uuid`, [userId])
      for (const n of body.nodes) {
        await query(
          `INSERT INTO ${ANNOTA_SCHEMA}.annota_nodes (id, user_id, name, parent_id, description, color, created_at) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7::timestamptz) ON CONFLICT (id) DO UPDATE SET name = $3, parent_id = $4, description = $5, color = $6`,
          [n.id, userId, n.name || "", n.parentId ?? null, n.description ?? null, n.color ?? null, n.createdAt || new Date().toISOString()]
        )
      }
    }
    if (Array.isArray(body.codes)) {
      await query(`DELETE FROM ${ANNOTA_SCHEMA}.annota_codes WHERE user_id = $1::uuid`, [userId])
      for (const c of body.codes) {
        const flagVal = c.flag === "key_quote" || c.flag === "negative_case" ? c.flag : null
        await query(
          `INSERT INTO ${ANNOTA_SCHEMA}.annota_codes (id, user_id, source_id, node_id, start, "end", excerpt, created_at, weight, coder_id, flag) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11) ON CONFLICT (id) DO UPDATE SET start = $5, "end" = $6, excerpt = $7, weight = $9, coder_id = $10, flag = $11`,
          [c.id, userId, c.sourceId, c.nodeId, c.start, c.end, c.excerpt ?? "", c.createdAt || new Date().toISOString(), c.weight ?? null, c.coderId ?? null, flagVal]
        )
      }
    }
    if (Array.isArray(body.memos)) {
      await query(`DELETE FROM ${ANNOTA_SCHEMA}.annota_memos WHERE user_id = $1::uuid`, [userId])
      for (const m of body.memos) {
        await query(
          `INSERT INTO ${ANNOTA_SCHEMA}.annota_memos (id, user_id, title, content, source_id, node_id, created_at, updated_at) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz) ON CONFLICT (id) DO UPDATE SET title = $3, content = $4, source_id = $5, node_id = $6, updated_at = $8::timestamptz`,
          [m.id, userId, m.title || "", m.content ?? "", m.sourceId ?? null, m.nodeId ?? null, m.createdAt || new Date().toISOString(), m.updatedAt || new Date().toISOString()]
        )
      }
    }

    res.json({ status: "success" })
  } catch (err: any) {
    console.error("❌ Annota POST data error:", err)
    res.status(500).json({ error: err?.message || "Lỗi lưu dữ liệu" })
  }
})

export default router
