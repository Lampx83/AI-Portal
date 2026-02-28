import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import path from "path"
import fs from "fs"
import { query } from "../../lib/db"
import { isAlwaysAdmin } from "../../lib/admin-utils"
import { getSetting, getBootstrapEnv } from "../../lib/settings"
import { parseCookies } from "../../lib/parse-cookies"
import { adminOnly } from "./middleware"
import { getBackendBaseUrl, getFrontendBaseUrl, SAMPLE_FILES } from "./shared"

const router = Router()

// GET /api/admin/enter - Enter admin page
router.get("/enter", async (req: Request, res: Response) => {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) {
    return res.status(503).json({ error: "NEXTAUTH_SECRET chưa cấu hình" })
  }
  const cookies = parseCookies(req.headers.cookie)
  try {
    const token = await getToken({
      req: { cookies, headers: req.headers } as any,
      secret,
    })
    if (!token?.id) {
      const base = getFrontendBaseUrl(req)
      const loginUrl = base ? `${base}/login?callbackUrl=${encodeURIComponent(req.originalUrl || "/api/admin/enter")}` : "/login"
      return res.redirect(302, loginUrl)
    }
    const userEmail = (token as { email?: string }).email as string | undefined
    let isAdmin = isAlwaysAdmin(userEmail)
    if (!isAdmin) {
      let row: { role?: string; is_admin?: boolean } | undefined
      const r = await query<{ role?: string; is_admin?: boolean }>(
        `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
        [token.id]
      )
      row = r.rows[0]
      if (!row && userEmail) {
        const r2 = await query<{ role?: string; is_admin?: boolean }>(
          `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [userEmail]
        )
        row = r2.rows[0]
      }
      isAdmin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
    }
    if (!isAdmin) {
      return res.status(403).json({
        error: "Bạn không có quyền truy cập trang quản trị",
      })
    }
    const adminSecret = getSetting("ADMIN_SECRET")
    if (adminSecret) {
      res.cookie("admin_secret", adminSecret, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
        secure: getBootstrapEnv("NODE_ENV", "development") === "production",
      })
    }
    const base = getFrontendBaseUrl(req)
    const adminBase = base.replace(/\/$/, "")
    const redirectPath = getSetting("ADMIN_REDIRECT_PATH") || `${adminBase}/admin`
    return res.redirect(302, redirectPath)
  } catch (err: any) {
    console.error("[admin/enter] error:", err?.message ?? err)
    const base = getFrontendBaseUrl(req)
    return res.redirect(302, base ? `${base}/login` : "/login")
  }
})

// POST /api/admin/auth - Admin login
router.post("/auth", (req: Request, res: Response) => {
  const secret = (req.body?.secret ?? req.query?.secret) as string | undefined
  const expected = getSetting("ADMIN_SECRET")
  const base = getFrontendBaseUrl(req)
  const adminBase = base.replace(/\/$/, "")
  const authRedirectPath = getSetting("ADMIN_REDIRECT_PATH") || `${adminBase}/admin`
  if (!expected || secret !== expected) {
    return res.redirect(`${authRedirectPath}?error=invalid`)
  }
  res.cookie("admin_secret", secret, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  })
  return res.redirect(authRedirectPath)
})

// GET /api/admin/sample-files
router.get("/sample-files", adminOnly, (req: Request, res: Response) => {
  const baseUrl = getBackendBaseUrl(req)
  const files = SAMPLE_FILES.map((f) => {
    const ext = f.replace(/^.*\./, "")
    return {
      filename: f,
      format: ext,
      url: `${baseUrl}/api/admin/sample-files/${f}`,
    }
  })
  res.json({ files })
})

// GET /api/admin/sample-files/:filename - Serve sample file (no admin required for orchestrator fetch)
router.get("/sample-files/:filename", (req: Request, res: Response) => {
  const filename = String(req.params.filename).replace(/[^a-zA-Z0-9._-]/g, "")
  if (!SAMPLE_FILES.includes(filename)) {
    return res.status(404).json({ error: "File không tồn tại" })
  }
  const possibleDirs = [
    path.join(process.cwd(), "sample-files"),
    path.join(__dirname, "../../../sample-files"),
    path.join(process.cwd(), "backend", "sample-files"),
  ]
  let filePath = ""
  for (const dir of possibleDirs) {
    const fp = path.join(dir, filename)
    if (fs.existsSync(fp)) {
      filePath = fp
      break
    }
  }
  if (!filePath) {
    return res.status(404).json({ error: "File chưa được tạo. Chạy: npm run generate-sample-files" })
  }
  res.sendFile(filePath)
})

const PLUGINS_AVAILABLE: {
  id: string
  name: string
  description: string
  mountPath: string
  assistantAlias: string
}[] = []

router.get("/plugins/available", adminOnly, (_req: Request, res: Response) => {
  res.json({ plugins: PLUGINS_AVAILABLE })
})

router.get("/plugins/installed", adminOnly, (req: Request, res: Response) => {
  try {
    const backendRoot = path.join(__dirname, "..", "..", "..")
    const agentsDir = path.join(backendRoot, "src", "agents")
    const installed: string[] = []
    if (fs.existsSync(agentsDir)) {
      for (const name of fs.readdirSync(agentsDir)) {
        const dir = path.join(agentsDir, name)
        if (!fs.statSync(dir).isDirectory()) continue
        if (fs.existsSync(path.join(dir, "manifest.json"))) installed.push(name)
      }
    }
    const { getMountedPaths } = require("../../lib/app-ref")
    const mounted = getMountedPaths() ? Array.from(getMountedPaths()!) : []
    res.json({ installed, mounted })
  } catch (err: any) {
    console.error("GET /plugins/installed error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

router.post("/plugins/install", adminOnly, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.body || {}
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "Thiếu agentId (vd. data-agent)" })
    }
    const plugin = PLUGINS_AVAILABLE.find((p) => p.id === agentId)
    if (!plugin) {
      return res.status(400).json({ error: "Plugin không tồn tại" })
    }

    const packageUrl = getSetting("DATA_AGENT_PACKAGE_URL")
    if (!packageUrl || typeof packageUrl !== "string" || !packageUrl.trim()) {
      return res.status(400).json({
        error: "Chưa cấu hình URL gói Data Agent",
        hint: "Đặt biến môi trường DATA_AGENT_PACKAGE_URL trỏ tới file zip đã đóng gói (vd. từ AI-Agents: npm run pack → host dist/data-agent.zip).",
      })
    }

    const backendRoot = path.join(__dirname, "..", "..", "..")
    const agentsDestDir = path.join(backendRoot, "src", "agents")
    const destDir = path.join(agentsDestDir, agentId)
    fs.mkdirSync(agentsDestDir, { recursive: true })

    const resFetch = await fetch(packageUrl.trim(), { method: "GET" })
    if (!resFetch.ok) {
      return res.status(502).json({
        error: "Không tải được gói plugin",
        detail: `HTTP ${resFetch.status}. Kiểm tra DATA_AGENT_PACKAGE_URL có đúng và truy cập được không.`,
      })
    }
    const zipBuffer = Buffer.from(await resFetch.arrayBuffer())
    if (zipBuffer.length === 0) {
      return res.status(502).json({ error: "Gói tải về rỗng" })
    }

    const AdmZip = require("adm-zip")
    const zip = new AdmZip(zipBuffer)
    zip.extractAllTo(destDir, true)

    if (!fs.existsSync(path.join(destDir, "manifest.json"))) {
      return res.status(500).json({
        error: "Gói zip không đúng định dạng (thiếu manifest.json). Đóng gói từ AI-Agents: npm run pack.",
      })
    }

    const indexPath = path.join(destDir, "index.ts")
    const indexJsPath = path.join(destDir, "index.js")
    const resolved = fs.existsSync(indexJsPath) ? indexJsPath : fs.existsSync(indexPath) ? indexPath : null
    if (!resolved) {
      return res.status(500).json({ error: "Gói plugin không có index.ts hoặc index.js" })
    }

    const { mountPlugin, getMountedPaths } = require("../../lib/app-ref")
    const alreadyMounted = getMountedPaths()?.has(plugin.mountPath)
    let mounted = false
    if (!alreadyMounted) {
      let mod: any
      try {
        mod = require(resolved)
      } catch (e: any) {
        return res.status(500).json({ error: "Không load được plugin: " + (e?.message || String(e)) })
      }
      const pluginRouter = mod?.default
      if (!pluginRouter) {
        return res.status(500).json({ error: "Plugin không export default router" })
      }
      mounted = mountPlugin(plugin.mountPath, pluginRouter)
    }

    await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, display_order, config_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (alias) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         config_json = EXCLUDED.config_json,
         updated_at = now()`,
      [
        plugin.assistantAlias,
        "Database",
        getBackendBaseUrl(req) + plugin.mountPath + "/v1",
        4,
        JSON.stringify({ isInternal: true, routing_hint: "Dữ liệu, data, thống kê" }),
      ]
    )

    console.log("[admin] Plugin installed and mounted:", agentId, "at", plugin.mountPath)
    res.json({
      success: true,
      message: alreadyMounted
        ? "Đã cập nhật file. Trợ lý đang chạy (khởi động lại backend nếu cần phiên bản mới)."
        : "Đã tải gói, cài plugin và thêm trợ lý. Có thể dùng ngay.",
      installed: true,
      mounted: mounted || alreadyMounted,
    })
  } catch (err: any) {
    console.error("POST /plugins/install error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

export default router
