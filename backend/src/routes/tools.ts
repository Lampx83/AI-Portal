// routes/tools.ts – Apps API (data), separate from assistants
import { Router, Request, Response } from "express"
import fs from "fs"
import path from "path"
import multer from "multer"
import AdmZip from "adm-zip"
import { getToolConfigs, getToolByAlias, getAllTools } from "../lib/tools"
import { recordToolOpen } from "../lib/tool-usage"
import { getToken } from "next-auth/jwt"
import { getSetting, getBootstrapEnv } from "../lib/settings"
import { parseCookies } from "../lib/parse-cookies"
import { query } from "../lib/db"

const router = Router()
const uploadUser = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })
const BACKEND_ROOT = path.join(__dirname, "..", "..")
const APPS_DIR = path.join(BACKEND_ROOT, "data", "apps")
const ALLOWED_ICONS = ["Bot", "Globe", "Package", "LayoutGrid", "Wrench", "Code", "Calculator", "FileText", "Search", "BookOpen", "GraduationCap", "Sparkles", "ListTodo", "Timer", "Gamepad", "BarChart2", "Settings", "Home", "Star", "Heart", "Zap"] as const
function normalizeIcon(icon: unknown): string {
  return typeof icon === "string" && (ALLOWED_ICONS as readonly string[]).includes(icon) ? icon : "Bot"
}
function getPortalBasePath(): string {
  return (getBootstrapEnv("BASE_PATH") || getSetting("PORTAL_PUBLIC_BASE_PATH") || "").replace(/\/+$/, "")
}
function writeEmbedConfig(appDir: string, alias: string, apiProxyTarget?: string): void {
  const basePath = getPortalBasePath()
  const publicDir = path.join(appDir, "public")
  fs.mkdirSync(publicDir, { recursive: true })
  const config: Record<string, string> = {}
  if (basePath) {
    config.basePath = basePath
    config.embedPath = `${basePath}/embed/${alias}`
  }
  if (typeof apiProxyTarget === "string" && apiProxyTarget.trim()) config.apiProxyTarget = apiProxyTarget.trim().replace(/\/+$/, "")
  if (Object.keys(config).length > 0) {
    fs.writeFileSync(path.join(publicDir, "embed-config.json"), JSON.stringify(config, null, 2), "utf-8")
  }
}

async function getCurrentUserId(req: Request): Promise<string | null> {
  const secret = getSetting("NEXTAUTH_SECRET") || getBootstrapEnv("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  const id = (token as { id?: string })?.id
  return id ?? null
}

// GET /api/tools - List app configs (only is_active = true). ?full=1 returns full tool objects in one response (tránh N+1 request từ frontend).
// Trả về tool toàn hệ thống + tool của user đăng nhập (nếu có).
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    const full = req.query.full === "1" || req.query.full === "true"
    if (full) {
      const configs = await getToolConfigs(userId ?? undefined)
      const tools = await getAllTools(configs)
      const withPinned = tools.map((t, i) => ({
        ...t,
        pinned: !!configs[i]?.pinned,
        category_slug: t.category_slug ?? null,
        category_name: t.category_name ?? null,
        user_installed: !!configs[i]?.isUserInstalled,
      }))
      return res.json(withPinned)
    }
    const configs = await getToolConfigs(userId ?? undefined)
    res.json(configs)
  } catch (error: unknown) {
    console.error("GET /api/tools error:", error)
    res.status(500).json({
      error: "Failed to fetch tool configs",
      message: (error as Error)?.message || "Unknown error",
    })
  }
})

// POST /api/tools/install-package - Cài ứng dụng cho chính user (chỉ tài khoản đó thấy). Yêu cầu đăng nhập.
router.post("/install-package", uploadUser.single("package"), async (req: Request, res: Response) => {
  try {
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Cần đăng nhập để cài ứng dụng" })
    }
    const file = (req as any).file
    if (!file?.buffer) {
      return res.status(400).json({ error: "Thiếu file gói. Gửi field 'package' dạng file .zip" })
    }
    const zip = new AdmZip(file.buffer)
    const entries = zip.getEntries()
    const manifestEntry = entries.find((e) => e.entryName === "manifest.json" || e.entryName.endsWith("/manifest.json"))
    if (!manifestEntry?.getData()) {
      return res.status(400).json({ error: "Gói không chứa manifest.json" })
    }
    const manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as {
      alias?: string
      id?: string
      name?: string
      icon?: string
      hasFrontendOnly?: boolean
      apiProxyTarget?: string
    }
    const baseAlias = String(manifest.alias ?? manifest.id ?? "").trim().toLowerCase()
    if (!baseAlias) {
      return res.status(400).json({ error: "manifest.json phải có id hoặc alias" })
    }
    const hasPublic = entries.some((e) => e.entryName === "public/index.html" || e.entryName.startsWith("public/"))
    const frontendOnly = !!(manifest.hasFrontendOnly && hasPublic)
    if (!frontendOnly) {
      return res.status(400).json({
        error: "Chỉ hỗ trợ gói frontend-only (có public/index.html). Gói có backend vui lòng cài từ trang Admin.",
      })
    }
    const shortId = userId.replace(/-/g, "").slice(0, 8)
    const alias = `u-${shortId}-${baseAlias}`
    fs.mkdirSync(APPS_DIR, { recursive: true })
    const appDir = path.join(APPS_DIR, alias)
    if (fs.existsSync(appDir)) {
      for (const name of fs.readdirSync(appDir)) {
        fs.rmSync(path.join(appDir, name), { recursive: true })
      }
    } else {
      fs.mkdirSync(appDir, { recursive: true })
    }
    ;(zip as unknown as { extractAllTo: (p: string, o: boolean) => void }).extractAllTo(appDir, true)
    const apiProxy = typeof manifest.apiProxyTarget === "string" && manifest.apiProxyTarget.trim()
      ? manifest.apiProxyTarget.trim().replace(/\/+$/, "")
      : undefined
    writeEmbedConfig(appDir, alias, apiProxy)
    const indexPath = path.join(appDir, "public", "index.html")
    if (!fs.existsSync(indexPath)) {
      return res.status(400).json({ error: "Gói frontend-only phải chứa public/index.html" })
    }
    const configJson = {
      embedded: true,
      frontendOnly: true,
      displayName: manifest.name ?? undefined,
      ...(apiProxy ? { apiProxyTarget: apiProxy } : {}),
    }
    const iconVal = normalizeIcon(manifest.icon)
    await query(
      `INSERT INTO ai_portal.tools (alias, icon, is_active, display_order, config_json, user_id, updated_at)
       VALUES ($1, $2, true, 0, $3::jsonb, $4::uuid, now())
       ON CONFLICT (user_id, alias) WHERE user_id IS NOT NULL DO UPDATE SET
         config_json = EXCLUDED.config_json,
         updated_at = now()`,
      [alias, iconVal, JSON.stringify(configJson), userId]
    )
    const result = await query(
      `SELECT id, alias, icon, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.tools WHERE alias = $1 AND user_id = $2::uuid`,
      [alias, userId]
    )
    res.status(200).json({ tool: result.rows[0], installed: true })
  } catch (err: any) {
    console.error("User install-package error:", err)
    res.status(500).json({ error: "Lỗi cài đặt", message: err?.message })
  }
})

// GET /api/tools/:alias - One app full (with metadata). Chỉ trả về nếu tool global hoặc thuộc user hiện tại.
router.get("/:alias", async (req: Request, res: Response) => {
  try {
    const alias = typeof req.params.alias === "string" ? req.params.alias : (req.params.alias as string[])?.[0] ?? ""
    if (!alias || alias === "install-package") {
      return res.status(400).json({ error: "Invalid alias" })
    }
    const userId = await getCurrentUserId(req)
    const tool = await getToolByAlias(alias, userId ?? undefined)
    if (!tool) {
      return res.status(404).json({ error: "Tool not found", message: `No tool with alias: ${alias}` })
    }
    res.json(tool)
  } catch (error: unknown) {
    console.error(`GET /api/tools/${req.params.alias} error:`, error)
    res.status(500).json({
      error: "Failed to fetch tool",
      message: (error as Error)?.message || "Unknown error",
    })
  }
})

// DELETE /api/tools/:alias - Gỡ cài ứng dụng do chính user cài. Chỉ cho phép khi tool.user_id = current user.
router.delete("/:alias", async (req: Request, res: Response) => {
  try {
    const alias = typeof req.params.alias === "string" ? req.params.alias : (req.params.alias as string[])?.[0] ?? ""
    if (!alias || alias === "install-package") {
      return res.status(400).json({ error: "Invalid alias" })
    }
    const userId = await getCurrentUserId(req)
    if (!userId) {
      return res.status(401).json({ error: "Cần đăng nhập để gỡ ứng dụng" })
    }
    const result = await query(
      `SELECT id, alias, config_json FROM ai_portal.tools WHERE alias = $1 AND user_id = $2::uuid`,
      [alias, userId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy ứng dụng hoặc bạn không có quyền gỡ cài" })
    }
    const appDir = path.join(APPS_DIR, alias)
    if (fs.existsSync(appDir)) {
      fs.rmSync(appDir, { recursive: true })
    }
    await query(`DELETE FROM ai_portal.tools WHERE alias = $1 AND user_id = $2::uuid`, [alias, userId])
    res.status(200).json({ success: true, message: "Đã gỡ cài ứng dụng" })
  } catch (err: any) {
    console.error("User uninstall error:", err)
    res.status(500).json({ error: "Lỗi gỡ cài đặt", message: err?.message })
  }
})

// POST /api/tools/:alias/opened - Ghi nhận một lần mở app (thống kê sử dụng)
router.post("/:alias/opened", async (req: Request, res: Response) => {
  try {
    const alias = typeof req.params.alias === "string" ? req.params.alias : (req.params.alias as string[])?.[0] ?? ""
    if (!alias) {
      return res.status(400).json({ error: "Invalid alias" })
    }
    await recordToolOpen(alias)
    res.status(204).send()
  } catch (error: unknown) {
    console.error(`POST /api/tools/${req.params.alias}/opened error:`, error)
    res.status(500).json({
      error: "Failed to record tool open",
      message: (error as Error)?.message || "Unknown error",
    })
  }
})

export default router
