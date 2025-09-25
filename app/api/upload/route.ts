import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { NextResponse } from "next/server"

const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY!,
    secretAccessKey: process.env.MINIO_SECRET_KEY!,
  },
  forcePathStyle: true,
})

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const folder = searchParams.get("folder")?.trim() || ""

  const formData = await req.formData()
  const files = formData.getAll("file") as File[]
   const userEmail = formData.get("userEmail") as string | null

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 })
  }

  const uploadedUrls: string[] = []

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Lấy extension gốc
    const parts = file.name.split(".")
    const ext = parts.length > 1 ? "." + parts.pop() : ""
    const baseName = parts.join(".")

    // Gắn thêm timestamp
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "")
    const uniqueName = `${baseName}_${timestamp}${ext}`

    // Nếu có folder thì thêm prefix
     const prefix = userEmail || folder
    const key = prefix ? `${prefix}/${uniqueName}` : uniqueName

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.MINIO_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    uploadedUrls.push(
      `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKET_NAME}/${key}`
    )
  }

  return NextResponse.json({
    status: "success",
    files: uploadedUrls,
  })
}
