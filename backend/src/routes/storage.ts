// routes/storage.ts
// MinIO Storage Management API
import { Router, Request, Response } from "express"
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  GetBucketLocationCommand,
} from "@aws-sdk/client-s3"
import { Readable } from "stream"

const router = Router()

// Khi ADMIN_SECRET được cấu hình, chỉ cho phép truy cập storage khi có mã quản trị (cùng logic với /api/admin)
function requireAdminSecret(req: Request, res: Response, next: () => void) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return next()
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  if (fromCookie === secret || fromHeader === secret) return next()
  res.status(403).json({ error: "Mã quản trị không hợp lệ", hint: "Truy cập / để đăng nhập quản trị" })
}

router.use(requireAdminSecret)

const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "research"

/**
 * GET /api/storage/connection-info
 * Thông tin kết nối MinIO (credentials được mask) để hiển thị trên dashboard
 */
router.get("/connection-info", (req: Request, res: Response) => {
  try {
    const endpoint = process.env.MINIO_ENDPOINT || "(not set)"
    const port = process.env.MINIO_PORT || "9000"
    const bucket = BUCKET_NAME
    const accessKeySet = !!process.env.MINIO_ACCESS_KEY
    const secretKeySet = !!process.env.MINIO_SECRET_KEY
    const consoleUrl = `http://${endpoint}:${Number(port) + 1000 || 9001}` // MinIO console thường là port + 1000
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

// Helper: Kiểm tra cấu hình MinIO
function checkMinIOConfig() {
  if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_PORT) {
    throw new Error("MinIO endpoint/port is not configured")
  }
  if (!process.env.MINIO_BUCKET_NAME) {
    throw new Error("MINIO_BUCKET_NAME is not configured")
  }
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

    const prefix = (req.query.prefix as string)?.trim() || ""
    const maxKeys = Math.min(Number(req.query.maxKeys) || 1000, 5000)
    const continuationToken = (req.query.continuationToken as string) || undefined
    const delimiter = (req.query.delimiter as string) || "/"

    console.log("📋 List objects request:", { prefix, maxKeys, continuationToken })

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix || undefined,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
      Delimiter: delimiter,
    })

    const response = await s3Client.send(command)

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
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
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

    const key = decodeURIComponent(req.params.key)

    console.log("ℹ️ Get object info:", key)

    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)

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
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
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

    const key = decodeURIComponent(req.params.key)

    console.log("⬇️ Download object:", key)

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const response = await s3Client.send(command)

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
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
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

    const key = decodeURIComponent(req.params.key)

    console.log("🗑️ Delete object:", key)

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)

    res.json({
      status: "success",
      message: `Object ${key} deleted successfully`,
    })
  } catch (error: any) {
    console.error("❌ Delete object error:", error)
    res.status(500).json({
      error: error.message || "Failed to delete object",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
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

    const prefix = decodeURIComponent(req.params.prefix)
    const maxKeys = Number(req.query.maxKeys) || 1000

    console.log("🗑️ Delete prefix:", prefix)

    // List tất cả objects trong prefix
    const objectsToDelete: string[] = []
    let continuationToken: string | undefined = undefined
    let hasMore = true

    while (hasMore) {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: maxKeys,
        ContinuationToken: continuationToken,
      })

      const listResponse = await s3Client.send(listCommand)

      if (listResponse.Contents) {
        objectsToDelete.push(...listResponse.Contents.map((obj) => obj.Key!))
      }

      hasMore = listResponse.IsTruncated || false
      continuationToken = listResponse.NextContinuationToken
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
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: batch.map((key) => ({ Key: key })),
            Quiet: false,
          },
        })

        const deleteResponse = await s3Client.send(deleteCommand)

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
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
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

    console.log("🗑️ Delete batch:", keys.length, "objects")

    // Xóa từng batch (tối đa 1000 objects mỗi lần)
    const batchSize = 1000
    let deletedCount = 0
    const errors: string[] = []

    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize)

      try {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: batch.map((key: string) => ({ Key: key })),
            Quiet: false,
          },
        })

        const deleteResponse = await s3Client.send(deleteCommand)

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
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
})

/**
 * GET /api/storage/stats
 * Lấy thống kê về bucket (tổng số objects, tổng dung lượng, etc.)
 * Query params:
 *   - prefix: Filter theo prefix (optional)
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    checkMinIOConfig()

    const prefix = (req.query.prefix as string)?.trim() || ""

    console.log("📊 Get bucket stats:", { prefix })

    let totalObjects = 0
    let totalSize = 0
    let continuationToken: string | undefined = undefined
    let hasMore = true
    const prefixes = new Set<string>()

    while (hasMore) {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix || undefined,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
        Delimiter: "/",
      })

      const response = await s3Client.send(command)

      if (response.Contents) {
        totalObjects += response.Contents.length
        totalSize += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0)
      }

      if (response.CommonPrefixes) {
        response.CommonPrefixes.forEach((p) => {
          if (p.Prefix) prefixes.add(p.Prefix)
        })
      }

      hasMore = response.IsTruncated || false
      continuationToken = response.NextContinuationToken
    }

    res.json({
      bucket: BUCKET_NAME,
      prefix: prefix || "all",
      totalObjects,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      prefixCount: prefixes.size,
      prefixes: Array.from(prefixes).sort(),
    })
  } catch (error: any) {
    console.error("❌ Get stats error:", error)
    res.status(500).json({
      error: error.message || "Failed to get stats",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
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
