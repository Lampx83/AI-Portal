// routes/storage.ts – Cấu hình MinIO từ Admin → Settings
import { Router, Request, Response } from "express"
import {
  S3Client,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetBucketLocationCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3"
import { Readable } from "stream"
import { getSetting } from "../lib/settings"

const router = Router()

function paramStr(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] ?? "" : p ?? ""
}

function requireAdminSecret(req: Request, res: Response, next: () => void) {
  const secret = getSetting("ADMIN_SECRET")
  if (!secret) return next()
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  if (fromCookie === secret || fromHeader === secret) return next()
  res.status(403).json({ error: "Mã quản trị không hợp lệ", hint: "Truy cập / để đăng nhập quản trị" })
}

router.use(requireAdminSecret)

function getS3Config() {
  const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
  const port = getSetting("MINIO_PORT", "9000")
  const region = getSetting("AWS_REGION", "us-east-1")
  const accessKey = getSetting("MINIO_ACCESS_KEY")
  const secretKey = getSetting("MINIO_SECRET_KEY")
  const bucket = getSetting("MINIO_BUCKET_NAME", "portal")
  return { endpoint, port, region, accessKey, secretKey, bucket }
}

let s3ClientInstance: S3Client | null = null
function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const { endpoint, port, region, accessKey, secretKey } = getS3Config()
    s3ClientInstance = new S3Client({
      endpoint: `http://${endpoint}:${port}`,
      region,
      credentials: { accessKeyId: accessKey || "", secretAccessKey: secretKey || "" },
      forcePathStyle: true,
    })
  }
  return s3ClientInstance
}

function getBucketName(): string {
  return getS3Config().bucket
}

/**
 * GET /api/storage/connection-info
 * Thông tin kết nối MinIO (credentials được mask) để hiển thị trên dashboard
 */
router.get("/connection-info", (req: Request, res: Response) => {
  try {
    const { endpoint, port, bucket, accessKey, secretKey } = getS3Config()
    const accessKeySet = !!accessKey
    const secretKeySet = !!secretKey
    const consoleUrl = `http://${endpoint}:${Number(port) + 1000 || 9001}`
    res.json({
      endpoint,
      port,
      bucket,
      accessKey: accessKeySet ? "****" : "(not set)",
      secretKey: secretKeySet ? "****" : "(not set)",
      apiUrl: `http://${endpoint}:${port}`,
      consoleUrl,
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

function checkMinIOConfig() {
  const { endpoint, port, bucket } = getS3Config()
  if (!endpoint || !port) throw new Error("MinIO endpoint/port chưa cấu hình. Cấu hình tại Admin → Settings.")
  if (!bucket) throw new Error("MINIO_getBucketName() chưa cấu hình. Cấu hình tại Admin → Settings.")
}

/** Tạo bucket nếu chưa tồn tại (tránh lỗi "The specified bucket does not exist" sau setup). */
async function ensureBucketExists(): Promise<void> {
  try {
    await getS3Client().send(new HeadBucketCommand({ Bucket: getBucketName() }))
    return
  } catch (e: any) {
    const isNoSuchBucket =
      e?.name === "NoSuchBucket" ||
      e?.$metadata?.httpStatusCode === 404 ||
      (typeof e?.message === "string" && e.message.toLowerCase().includes("bucket") && e.message.toLowerCase().includes("does not exist"))
    if (!isNoSuchBucket) throw e
  }
  await getS3Client().send(new CreateBucketCommand({ Bucket: getBucketName() }))
}

/**
 * GET /api/storage/list
 * List objects trong bucket với pagination và filter
 * Query params:
 *   - prefix: Filter theo prefix (folder path)
 *   - maxKeys: Số lượng objects tối đa (default: 1000)
 *   - continuationToken: Token để pagination
 *   - delimiter: Delimiter để group objects (default: /)
 */
router.get("/list", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()
    await ensureBucketExists()

    const prefix = (req.query.prefix as string)?.trim() || ""
    const maxKeys = Math.min(Number(req.query.maxKeys) || 1000, 5000)
    const continuationToken = (req.query.continuationToken as string) || undefined
    const delimiter = (req.query.delimiter as string) || "/"

    const command = new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix: prefix || undefined,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
      Delimiter: delimiter,
    })

    const response = await getS3Client().send(command)

    // Phân loại objects và prefixes (folders)
    const objects = (response.Contents || []).map((obj) => ({
      key: obj.Key!,
      size: obj.Size || 0,
      lastModified: obj.LastModified?.toISOString() || null,
      etag: obj.ETag?.replace(/"/g, "") || null,
      storageClass: obj.StorageClass || "STANDARD",
    }))

    const prefixes = (response.CommonPrefixes || []).map((p) => ({
      prefix: p.Prefix!,
    }))

    res.json({
      objects,
      prefixes,
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken || null,
      keyCount: response.KeyCount || 0,
      prefixCount: prefixes.length,
    })
  } catch (error: any) {
    console.error("❌ List objects error:", error)
    res.status(500).json({
      error: error.message || "Failed to list objects",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined,
    })
  }
})

/**
 * GET /api/storage/info/:key
 * Lấy thông tin chi tiết của một object
 * Key phải được encode trong URL
 */
router.get("/info/:key(*)", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()

    const key = decodeURIComponent(paramStr(req.params.key))

    const command = new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    })

    const response = await getS3Client().send(command)

    res.json({
      key,
      size: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      lastModified: response.LastModified?.toISOString() || null,
      etag: response.ETag?.replace(/"/g, "") || null,
      metadata: response.Metadata || {},
      storageClass: response.StorageClass || "STANDARD",
    })
  } catch (error: any) {
    console.error("❌ Get object info error:", error)
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: "Object not found" })
    }
    res.status(500).json({
      error: error.message || "Failed to get object info",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined,
    })
  }
})

/**
 * GET /api/storage/download/:key
 * Download một object
 * Key phải được encode trong URL
 */
router.get("/download/:key(*)", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()

    const key = decodeURIComponent(paramStr(req.params.key))

    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    })

    const response = await getS3Client().send(command)

    // Set headers
    const contentType = response.ContentType || "application/octet-stream"
    const contentDisposition = `attachment; filename="${key.split("/").pop()}"`

    res.setHeader("Content-Type", contentType)
    res.setHeader("Content-Disposition", contentDisposition)
    res.setHeader("Content-Length", response.ContentLength || 0)

    // Stream response
    if (response.Body instanceof Readable) {
      response.Body.pipe(res)
    } else if (response.Body) {
      // Nếu Body là Uint8Array hoặc Buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      res.send(buffer)
    } else {
      res.status(404).json({ error: "Object body is empty" })
    }
  } catch (error: any) {
    console.error("❌ Download object error:", error)
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: "Object not found" })
    }
    res.status(500).json({
      error: error.message || "Failed to download object",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined,
    })
  }
})

/**
 * DELETE /api/storage/object/:key
 * Xóa một object
 * Key phải được encode trong URL
 */
router.delete("/object/:key(*)", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()

    const key = decodeURIComponent(paramStr(req.params.key))

    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    })

    await getS3Client().send(command)

    res.json({
      status: "success",
      message: `Object ${key} deleted successfully`,
    })
  } catch (error: any) {
    console.error("❌ Delete object error:", error)
    res.status(500).json({
      error: error.message || "Failed to delete object",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined,
    })
  }
})

/**
 * DELETE /api/storage/prefix/:prefix
 * Xóa tất cả objects trong một prefix (folder)
 * Prefix phải được encode trong URL
 */
router.delete("/prefix/:prefix(*)", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()

    const prefix = decodeURIComponent(paramStr(req.params.prefix))
    const maxKeys = Number(req.query.maxKeys) || 1000

    // List tất cả objects trong prefix
    const objectsToDelete: string[] = []
    let continuationToken: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const listCmd = new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      })

      const listResp = (await getS3Client().send(listCmd)) as ListObjectsV2CommandOutput

      if (listResp.Contents) {
        objectsToDelete.push(...listResp.Contents.map((obj: { Key?: string }) => obj.Key!))
      }

      hasMore = listResp.IsTruncated || false
      continuationToken = listResp.NextContinuationToken
    }

    if (objectsToDelete.length === 0) {
      return res.json({
        status: "success",
        message: `No objects found in prefix ${prefix}`,
        deletedCount: 0,
      })
    }

    // Xóa từng batch (MinIO hỗ trợ xóa tối đa 1000 objects mỗi lần)
    const batchSize = 1000
    let deletedCount = 0
    const errors: string[] = []

    for (let i = 0; i < objectsToDelete.length; i += batchSize) {
      const batch = objectsToDelete.slice(i, i + batchSize)

      try {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: getBucketName(),
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: false,
          },
        })

        const deleteResponse = await getS3Client().send(deleteCommand)

        if (deleteResponse.Deleted) {
          deletedCount += deleteResponse.Deleted.length
        }

        if (deleteResponse.Errors) {
          deleteResponse.Errors.forEach((err) => {
            errors.push(`${err.Key}: ${err.Message}`)
          })
        }
      } catch (batchError: any) {
        console.error(`❌ Error deleting batch ${i}-${i + batch.length}:`, batchError)
        errors.push(`Batch ${i}-${i + batch.length}: ${batchError.message}`)
      }
    }

    if (errors.length > 0 && deletedCount === 0) {
      return res.status(500).json({
        error: "Failed to delete objects",
        errors,
      })
    }

    res.json({
      status: errors.length > 0 ? "partial" : "success",
      message: `Deleted ${deletedCount} objects from prefix ${prefix}`,
      deletedCount,
      totalCount: objectsToDelete.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("❌ Delete prefix error:", error)
    res.status(500).json({
      error: error.message || "Failed to delete prefix",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined,
    })
  }
})

/**
 * POST /api/storage/delete-batch
 * Xóa nhiều objects cùng lúc
 * Body: { keys: string[] }
 */
router.post("/delete-batch", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()

    const { keys } = req.body

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: "keys must be a non-empty array" })
    }

    // Xóa từng batch (tối đa 1000 objects mỗi lần)
    const batchSize = 1000
    let deletedCount = 0
    const errors: string[] = []

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize)

      try {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: getBucketName(),
          Delete: {
            Objects: batch.map((key: string) => ({ Key: key })),
            Quiet: false,
          },
        })

        const deleteResponse = await getS3Client().send(deleteCommand)

        if (deleteResponse.Deleted) {
          deletedCount += deleteResponse.Deleted.length
        }

        if (deleteResponse.Errors) {
          deleteResponse.Errors.forEach((err) => {
            errors.push(`${err.Key}: ${err.Message}`)
          })
        }
      } catch (batchError: any) {
        console.error(`❌ Error deleting batch ${i}-${i + batch.length}:`, batchError)
        errors.push(`Batch ${i}-${i + batch.length}: ${batchError.message}`)
      }
    }

    if (errors.length > 0 && deletedCount === 0) {
      return res.status(500).json({
        error: "Failed to delete objects",
        errors,
      })
    }

    res.json({
      status: errors.length > 0 ? "partial" : "success",
      message: `Deleted ${deletedCount} objects`,
      deletedCount,
      totalCount: keys.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("❌ Delete batch error:", error)
    res.status(500).json({
      error: error.message || "Failed to delete objects",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined,
    })
  }
})

/**
 * GET /api/storage/stats
 * Thống kê bucket: tổng số object và tổng dung lượng (đệ quy theo prefix).
 * Không dùng Delimiter để đếm/tính toàn bộ object dưới prefix.
 * Query params:
 *   - prefix: Nếu có thì chỉ tính trong folder đó; không có thì tính toàn bucket.
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()
    await ensureBucketExists()

    const prefix = (req.query.prefix as string)?.trim() || ""

    let totalObjects = 0
    let totalSize = 0
    let continuationToken: string | undefined = undefined
    let hasMore = true

    // Không dùng Delimiter để list đệ quy toàn bộ object dưới prefix
    while (hasMore) {
      const listCmd = new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: prefix || undefined,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      })

      const listResp = (await getS3Client().send(listCmd)) as ListObjectsV2CommandOutput

      if (listResp.Contents) {
        totalObjects += listResp.Contents.length
        totalSize += listResp.Contents.reduce(
          (sum: number, obj: { Size?: number }) => sum + (obj.Size || 0),
          0
        )
      }

      hasMore = listResp.IsTruncated || false
      continuationToken = listResp.NextContinuationToken
    }

    res.json({
      bucket: getBucketName(),
      prefix: prefix || "all",
      totalObjects,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
    })
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode
    const is403 = status === 403
    if (is403) {
      console.warn("❌ Get stats: S3 access denied (403). Kiểm tra MINIO_* / AWS credentials và quyền bucket.")
    } else {
      console.error("❌ Get stats error:", error?.message ?? error)
    }
    res.status(is403 ? 403 : 500).json({
      error: is403
        ? "S3 access denied. Kiểm tra MINIO_ACCESS_KEY, MINIO_SECRET_KEY và quyền bucket."
        : error?.message || "Failed to get stats",
      details: getSetting("DEBUG") === "true" ? error?.stack : undefined,
    })
  }
})

// Helper function để format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export default router
