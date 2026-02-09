/**
 * Proxy to Datalake (LakeFlow) inbox API: upload files to 000_inbox and list by domain.
 * Mount under /api/admin/datalake-inbox with adminOnly.
 * URL: getLakeFlowApiUrl() — Docker dùng host.docker.internal:8011, local dùng LAKEFLOW_API_URL hoặc localhost:8011.
 */
import { Router, Request, Response } from "express"
import multer from "multer"
import { getLakeFlowApiUrl, getQdrantUrlForDatalake } from "../lib/config"

const router = Router()

const upload = multer({ storage: multer.memoryStorage() })

// GET /api/admin/datalake-inbox/domains -> GET LakeFlow/inbox/domains
router.get("/domains", async (req: Request, res: Response) => {
  try {
    const baseUrl = getLakeFlowApiUrl()
    const r = await fetch(`${baseUrl}/inbox/domains`)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json(data)
    }
    res.json(data)
  } catch (e: any) {
    const baseUrl = getLakeFlowApiUrl()
    const inDocker = process.env.RUNNING_IN_DOCKER === "true"
    let hint = ""
    if (inDocker && (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"))) {
      hint = " Research chạy trong Docker: từ container không dùng được localhost. Set LAKEFLOW_API_URL=http://host.docker.internal:8011 (Mac/Windows) hoặc IP máy host (Linux)."
    }
    console.error("[datalake-inbox] GET /domains error:", e?.message ?? e)
    res.status(502).json({
      error: `Không kết nối được tới Datalake. LAKEFLOW_API_URL đang dùng: ${baseUrl}.${hint} Chi tiết: ${e?.message ?? ""}`.trim(),
      detail: e?.message,
    })
  }
})

// GET /api/admin/datalake-inbox/list?domain=...&path=... -> GET LakeFlow/inbox/list (path = subpath, nhiều cấp)
router.get("/list", async (req: Request, res: Response) => {
  try {
    const baseUrl = getLakeFlowApiUrl()
    const domain = (req.query.domain as string) || ""
    const path = (req.query.path as string) || ""
    const params = new URLSearchParams()
    if (domain) params.set("domain", domain)
    if (path.trim()) params.set("path", path.trim())
    const qs = params.toString()
    const url = `${baseUrl}/inbox/list${qs ? `?${qs}` : ""}`
    const r = await fetch(url)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json(data)
    }
    res.json(data)
  } catch (e: any) {
    const baseUrl = getLakeFlowApiUrl()
    const inDocker = process.env.RUNNING_IN_DOCKER === "true"
    let hint = ""
    if (inDocker && (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"))) {
      hint = " Research chạy trong Docker: từ container không dùng được localhost. Set LAKEFLOW_API_URL=http://host.docker.internal:8011 (Mac/Windows) hoặc IP máy host (Linux)."
    }
    console.error("[datalake-inbox] GET /list error:", e?.message ?? e)
    res.status(502).json({
      error: `Không kết nối được tới Datalake. LAKEFLOW_API_URL đang dùng: ${baseUrl}.${hint} Chi tiết: ${e?.message ?? ""}`.trim(),
      detail: e?.message,
    })
  }
})

// POST /api/admin/datalake-inbox/upload: multipart form { domain, path?, files[] } -> proxy to Datalake
router.post("/upload", upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const domain = (req.body?.domain as string)?.trim()
    const path = (req.body?.path as string)?.trim() ?? ""
    const files = req.files as Express.Multer.File[]
    if (!domain) {
      return res.status(400).json({ error: "Thiếu domain (thư mục đích dưới 000_inbox)" })
    }
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Chưa chọn file nào" })
    }

    // Dùng tên file từ client (UTF-8) thay vì f.originalname để tránh lỗi encoding multipart
    let fileNames: string[] = []
    try {
      const raw = (req.body?.file_names as string) || "[]"
      fileNames = JSON.parse(typeof raw === "string" ? raw : "[]") as string[]
    } catch {
      fileNames = []
    }

    const form = new FormData()
    form.append("domain", domain)
    if (path) form.append("path", path)
    // Ghi vector vào Qdrant Research (Datalake step4 dùng qdrant_url này)
    form.append("qdrant_url", getQdrantUrlForDatalake())
    files.forEach((f, i) => {
      let name = fileNames[i] != null && fileNames[i].trim() ? fileNames[i].trim() : f.originalname || "file"
      // Chỉ lấy basename (tránh path traversal)
      if (name.includes("/") || name.includes("\\")) name = name.replace(/^.*[/\\]/, "")
      form.append("files", new Blob([f.buffer]), name)
    })

    const baseUrl = getLakeFlowApiUrl()
    const r = await fetch(`${baseUrl}/inbox/upload`, {
      method: "POST",
      body: form,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      const errMsg = (data as { detail?: string })?.detail ?? (data as { error?: string })?.error ?? `Datalake ${r.status}`
      console.error("[datalake-inbox] POST /upload Datalake error:", r.status, errMsg)
      return res.status(r.status).json({ error: errMsg, detail: typeof (data as { detail?: string }).detail === "string" ? (data as { detail: string }).detail : errMsg })
    }
    res.json(data)
  } catch (e: any) {
    const baseUrl = getLakeFlowApiUrl()
    const inDocker = process.env.RUNNING_IN_DOCKER === "true"
    let hint = ""
    if (inDocker && (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"))) {
      hint = " Research chạy trong Docker: từ container không dùng được localhost. Set LAKEFLOW_API_URL=http://host.docker.internal:8011 (Mac/Windows) hoặc IP máy host (Linux)."
    }
    console.error("[datalake-inbox] POST /upload error:", e?.message ?? e)
    res.status(502).json({
      error: `Không kết nối được tới Datalake. LAKEFLOW_API_URL đang dùng: ${baseUrl}.${hint} Chi tiết: ${e?.message ?? ""}`.trim(),
      detail: e?.message,
    })
  }
})

export default router
