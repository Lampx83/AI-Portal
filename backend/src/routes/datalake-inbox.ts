/**
 * Proxy to Datalake (LakeFlow) inbox API: upload files to 000_inbox and list by domain.
 * Mount under /api/admin/datalake-inbox with adminOnly.
 * Env: LAKEFLOW_API_URL (e.g. http://localhost:8011 or http://lakeflow-backend:8011)
 */
import { Router, Request, Response } from "express"
import multer from "multer"

const router = Router()
const LAKEFLOW_API_URL = (process.env.LAKEFLOW_API_URL || "http://localhost:8011").replace(/\/+$/, "")

const upload = multer({ storage: multer.memoryStorage() })

// GET /api/admin/datalake-inbox/domains -> GET LAKEFLOW_API_URL/inbox/domains
router.get("/domains", async (req: Request, res: Response) => {
  try {
    const r = await fetch(`${LAKEFLOW_API_URL}/inbox/domains`)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json(data)
    }
    res.json(data)
  } catch (e: any) {
    console.error("[datalake-inbox] GET /domains error:", e?.message ?? e)
    res.status(502).json({ error: "Không kết nối được tới Datalake", detail: e?.message })
  }
})

// GET /api/admin/datalake-inbox/list?domain=... -> GET LAKEFLOW_API_URL/inbox/list?domain=...
router.get("/list", async (req: Request, res: Response) => {
  try {
    const domain = (req.query.domain as string) || ""
    const url = `${LAKEFLOW_API_URL}/inbox/list${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`
    const r = await fetch(url)
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json(data)
    }
    res.json(data)
  } catch (e: any) {
    console.error("[datalake-inbox] GET /list error:", e?.message ?? e)
    res.status(502).json({ error: "Không kết nối được tới Datalake", detail: e?.message })
  }
})

// POST /api/admin/datalake-inbox/upload: multipart form { domain, files[] } -> proxy to Datalake
router.post("/upload", upload.array("files", 20), async (req: Request, res: Response) => {
  try {
    const domain = (req.body?.domain as string)?.trim()
    const files = req.files as Express.Multer.File[]
    if (!domain) {
      return res.status(400).json({ error: "Thiếu domain (thư mục đích dưới 000_inbox)" })
    }
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "Chưa chọn file nào" })
    }

    const form = new FormData()
    form.append("domain", domain)
    for (const f of files) {
      form.append("files", new Blob([f.buffer]), f.originalname || "file")
    }

    const r = await fetch(`${LAKEFLOW_API_URL}/inbox/upload`, {
      method: "POST",
      body: form,
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json(data)
    }
    res.json(data)
  } catch (e: any) {
    console.error("[datalake-inbox] POST /upload error:", e?.message ?? e)
    res.status(502).json({ error: "Không kết nối được tới Datalake", detail: e?.message })
  }
})

export default router
