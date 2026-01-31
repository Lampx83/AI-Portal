// routes/upload.ts
import { Router, Request, Response } from "express"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import multer from "multer"

const router = Router()

const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
})

const upload = multer({ storage: multer.memoryStorage() })

router.post("/", upload.array("file"), async (req: Request, res: Response) => {
  try {
    const folder = (req.query.folder as string)?.trim() || ""
    const files = req.files as Express.Multer.File[]
    const userEmail = req.body.userEmail as string | null

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No file" })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      const buffer = file.buffer

      const parts = file.originalname.split(".")
      const ext = parts.length > 1 ? "." + parts.pop() : ""
      const baseName = parts.join(".")

      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "")
      const uniqueName = `${baseName}_${timestamp}${ext}`

      const prefix = userEmail || folder
      const key = prefix ? `${prefix}/${uniqueName}` : uniqueName

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.MINIO_BUCKET_NAME!,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
        })
      )

      uploadedUrls.push(
        `http://${process.env.MINIO_ENDPOINT_PUBLIC}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKET_NAME}/${key}`
      )
    }

    res.json({
      status: "success",
      files: uploadedUrls,
    })
  } catch (error: any) {
    console.error("Upload error:", error)
    res.status(500).json({ error: error.message || "Upload failed" })
  }
})

export default router
