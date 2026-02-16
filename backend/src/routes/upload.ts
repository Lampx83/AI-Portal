// routes/upload.ts
import { Router, Request, Response } from "express"
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3"
import multer from "multer"
import crypto from "crypto"
import { getSetting } from "../lib/settings"

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
    const baseUrl = `http://${endpointPublic}:${port}/${bucket}`

    for (const file of files) {
      try {
        const buffer = file.buffer

        if (!buffer || buffer.length === 0) {
          errors.push(`${file.originalname}: File buffer is empty`)
          continue
        }

        // Hash nội dung để cùng file chỉ lưu 1 lần trên MinIO
        const hash = crypto.createHash("sha256").update(buffer).digest("hex")
        const parts = file.originalname.split(".")
        const ext = parts.length > 1 ? "." + parts.pop()!.toLowerCase() : ""
        const prefix = userEmail || folder
        const key = prefix ? `${prefix}/${hash}${ext}` : `${hash}${ext}`

        // Đã tồn tại object cùng key (cùng nội dung) → dùng lại URL, không upload lại
        try {
          await s3Client.send(
            new HeadObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          )
          const publicUrl = `${baseUrl}/${key}`
          uploadedUrls.push(publicUrl)
          continue
        } catch (_) {
          // Không tồn tại → upload mới
        }

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: file.mimetype || "application/octet-stream",
          })
        )

        const publicUrl = `${baseUrl}/${key}`
        uploadedUrls.push(publicUrl)
      } catch (fileError: any) {
        console.error(`❌ Failed to upload ${file.originalname}:`, fileError)
        errors.push(`${file.originalname}: ${fileError.message || "Upload failed"}`)
      }
    }

    // Nếu có lỗi và không có file nào upload thành công
    if (errors.length > 0 && uploadedUrls.length === 0) {
      return res.status(500).json({ 
        error: "All files failed to upload",
        details: errors
      })
    }

    // Nếu có một số file thành công và một số thất bại
    if (errors.length > 0) {
      return res.status(207).json({ // 207 Multi-Status
        status: "partial",
        files: uploadedUrls,
        errors: errors,
      })
    }

    // Tất cả đều thành công
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
