// routes/upload.ts
import { Router, Request, Response } from "express"
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3"
import multer from "multer"
import crypto from "crypto"
import { getSetting } from "../lib/settings"

/** Đặt MINIO_SKIP_PUBLIC_BUCKET_POLICY=true nếu không muốn bucket cho phép GetObject ẩn danh (vd. chỉ S3 private + CDN). */
function skipAnonymousReadPolicy(): boolean {
  return process.env.MINIO_SKIP_PUBLIC_BUCKET_POLICY === "true"
}

const bucketPolicyPromises = new Map<string, Promise<void>>()

/** Tạo bucket nếu thiếu; gắn policy cho phép trình duyệt tải ảnh qua URL công khai (MinIO dev mặc định hay 403). */
async function ensureBucketAllowsAnonymousGet(s3: S3Client, bucket: string): Promise<void> {
  if (skipAnonymousReadPolicy()) return
  let p = bucketPolicyPromises.get(bucket)
  if (!p) {
    const task = (async () => {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }))
      } catch (e: unknown) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number }; message?: string }
        const msg = String(err?.message ?? "").toLowerCase()
        const noBucket =
          err?.name === "NotFound" ||
          err?.$metadata?.httpStatusCode === 404 ||
          (msg.includes("bucket") && msg.includes("does not exist"))
        if (!noBucket) throw e
        await s3.send(new CreateBucketCommand({ Bucket: bucket }))
      }
      const policy = JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: "*",
            Action: "s3:GetObject",
            Resource: `arn:aws:s3:::${bucket}/*`,
          },
        ],
      })
      try {
        await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }))
      } catch (e: unknown) {
        const m = (e as Error)?.message ?? String(e)
        console.warn(
          "[upload] PutBucketPolicy failed — browser <img src> may return 403 until bucket allows public GetObject:",
          m
        )
      }
    })()
    task.catch(() => bucketPolicyPromises.delete(bucket))
    bucketPolicyPromises.set(bucket, task)
    p = task
  }
  await p
}

const router = Router()

function getS3Config() {
  const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
  const port = getSetting("MINIO_PORT", "9000")
  const accessKey = getSetting("MINIO_ACCESS_KEY")
  const secretKey = getSetting("MINIO_SECRET_KEY")
  const region = getSetting("AWS_REGION", "us-east-1")
  return { endpoint, port, accessKey, secretKey, region }
}

function getS3Client(): S3Client {
  const { endpoint, port, accessKey, secretKey, region } = getS3Config()
  return new S3Client({
    endpoint: `http://${endpoint}:${port}`,
    region,
    credentials: accessKey && secretKey ? { accessKeyId: accessKey, secretAccessKey: secretKey } : undefined as any,
    forcePathStyle: true,
  })
}

const upload = multer({ storage: multer.memoryStorage() })

/** Khi DB/cache cũ vẫn ghép http://minio:... — ép lại nếu container có MINIO_PUBLIC_BASE_URL. */
function rewriteBrowserPublicUrl(url: string): string {
  const override = process.env.MINIO_PUBLIC_BASE_URL?.trim()
  if (!override || !/https?:\/\/minio(?::\d+)?\//i.test(url)) return url
  try {
    const u = new URL(url)
    return `${override.replace(/\/+$/, "")}${u.pathname}${u.search}${u.hash}`
  } catch {
    return url
  }
}

router.post("/", upload.array("file"), async (req: Request, res: Response) => {
  try {
    const folder = (req.query.folder as string)?.trim() || ""
    const files = req.files as Express.Multer.File[]
    const userEmail = req.body.userEmail as string | null

    if (!files || files.length === 0) {
      console.error("❌ No files in request")
      return res.status(400).json({ error: "No file provided" })
    }

    const bucket = getSetting("MINIO_BUCKET_NAME", "portal")
    const endpoint = getSetting("MINIO_ENDPOINT", "localhost")
    const port = getSetting("MINIO_PORT", "9000")
    const endpointPublic = getSetting("MINIO_ENDPOINT_PUBLIC") || endpoint

    if (!bucket) {
      console.error("❌ MINIO_BUCKET_NAME is not configured")
      return res.status(500).json({ error: "Storage configuration error: MINIO_BUCKET_NAME is missing" })
    }

    if (!endpoint || !port) {
      console.error("❌ MinIO endpoint/port is not configured")
      return res.status(500).json({ error: "Storage configuration error: MinIO endpoint/port is missing" })
    }

    const uploadedUrls: string[] = []
    const errors: string[] = []
    const s3Client = getS3Client()
    await ensureBucketAllowsAnonymousGet(s3Client, bucket)

    /** Full public base for browser-accessible URLs, e.g. http://localhost:9000/portal (set when MinIO hostname is internal like `minio`) */
    const publicBaseOverride = getSetting("MINIO_PUBLIC_BASE_URL")?.trim()
    const defaultBaseUrl = `http://${endpointPublic}:${port}/${bucket}`
    const publicUrlForKey = (key: string) =>
      publicBaseOverride
        ? `${publicBaseOverride.replace(/\/+$/, "")}/${key}`
        : `${defaultBaseUrl}/${key}`

    for (const file of files) {
      try {
        const buffer = file.buffer

        if (!buffer || buffer.length === 0) {
          errors.push(`${file.originalname}: File buffer is empty`)
          continue
        }

        // Hash content so same file is stored once on MinIO
        const hash = crypto.createHash("sha256").update(buffer).digest("hex")
        const parts = file.originalname.split(".")
        const ext = parts.length > 1 ? "." + parts.pop()!.toLowerCase() : ""
        const prefix = userEmail || folder
        const key = prefix ? `${prefix}/${hash}${ext}` : `${hash}${ext}`

        // Object with same key already exists (same content) → reuse URL, skip upload
        try {
          await s3Client.send(
            new HeadObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          )
          const publicUrl = rewriteBrowserPublicUrl(publicUrlForKey(key))
          uploadedUrls.push(publicUrl)
          continue
        } catch (_) {
          // Does not exist → upload new
        }

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: file.mimetype || "application/octet-stream",
          })
        )

        const publicUrl = rewriteBrowserPublicUrl(publicUrlForKey(key))
        uploadedUrls.push(publicUrl)
      } catch (fileError: any) {
        console.error(`❌ Failed to upload ${file.originalname}:`, fileError)
        errors.push(`${file.originalname}: ${fileError.message || "Upload failed"}`)
      }
    }

    // If error and no file uploaded successfully
    if (errors.length > 0 && uploadedUrls.length === 0) {
      return res.status(500).json({ 
        error: "All files failed to upload",
        details: errors
      })
    }

    // If some files succeeded and some failed
    if (errors.length > 0) {
      return res.status(207).json({ // 207 Multi-Status
        status: "partial",
        files: uploadedUrls,
        errors: errors,
      })
    }

    // All succeeded
    res.json({
      status: "success",
      files: uploadedUrls,
    })
  } catch (error: any) {
    console.error("❌ Upload error:", error)
    console.error("   Error stack:", error.stack)
    res.status(500).json({ 
      error: error.message || "Upload failed",
      details: getSetting("DEBUG") === "true" ? error.stack : undefined
    })
  }
})

export default router
