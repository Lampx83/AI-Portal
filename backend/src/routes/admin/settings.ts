/**
 * Admin settings: branding (system name editable, database name read-only) and SSO config.
 */
import { Router, Request, Response } from "express"
import path from "path"
import fs from "fs"
import { query, getDatabaseName, resetPool } from "../../lib/db"
import { getSetting } from "../../lib/settings"
import { adminOnly } from "./middleware"

const router = Router()

const BACKEND_ROOT = path.join(__dirname, "..", "..", "..")
const DATA_DIR = path.join(BACKEND_ROOT, "data")
const BRANDING_FILE = path.join(DATA_DIR, "setup-branding.json")
const SETUP_DB_FILE = path.join(DATA_DIR, "setup-db.json")
const DB_NAME_REGEX = /^[a-z0-9_]{1,63}$/

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

/** Read branding from DB (app_settings) or from file. */
async function getBrandingFromDbOrFile(): Promise<{ systemName: string; logoDataUrl?: string; systemSubtitle?: string; themeColor?: string; hideNewChatOnAdmin?: boolean; hideAppsAllOnAdmin?: boolean; hideAssistantsAllOnAdmin?: boolean }> {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('system_name', 'logo_data_url', 'system_subtitle', 'theme_color', 'hide_new_chat_on_admin', 'hide_apps_all_on_admin', 'hide_assistants_all_on_admin')`
    )
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]))
    const systemName = (map.system_name ?? "").trim()
    if (systemName) {
      const systemSubtitle = (map.system_subtitle ?? "").trim() || undefined
      const themeColor = (map.theme_color ?? "").trim() || undefined
      const hideNewChatOnAdmin = map.hide_new_chat_on_admin === "true"
      const hideAppsAllOnAdmin = map.hide_apps_all_on_admin === "true"
      const hideAssistantsAllOnAdmin = map.hide_assistants_all_on_admin === "true"
      return {
        systemName,
        logoDataUrl: (map.logo_data_url ?? "").trim() || undefined,
        systemSubtitle,
        themeColor: themeColor && /^#[0-9A-Fa-f]{6}$/.test(themeColor) ? themeColor : undefined,
        hideNewChatOnAdmin,
        hideAppsAllOnAdmin,
        hideAssistantsAllOnAdmin,
      }
    }
  } catch {
    // DB not ready or no data
  }
  ensureDataDir()
  if (!fs.existsSync(BRANDING_FILE)) {
    return { systemName: "", themeColor: undefined }
  }
  try {
    const raw = fs.readFileSync(BRANDING_FILE, "utf8")
    const data = JSON.parse(raw) as { systemName?: string; logoDataUrl?: string; systemSubtitle?: string; themeColor?: string }
    const name = typeof data.systemName === "string" ? data.systemName.trim() : ""
    const systemSubtitle = typeof data.systemSubtitle === "string" ? data.systemSubtitle.trim() : undefined
    const themeColor = typeof data.themeColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(data.themeColor.trim()) ? data.themeColor.trim() : undefined
    return {
      systemName: name,
      logoDataUrl: typeof data.logoDataUrl === "string" && data.logoDataUrl ? data.logoDataUrl : undefined,
      systemSubtitle: systemSubtitle || undefined,
      themeColor,
    }
  } catch {
    return { systemName: "", themeColor: undefined }
  }
}

/**
 * GET /api/admin/settings/branding
 * Returns systemName, logoDataUrl (editable) and databaseName (read-only).
 */
router.get("/branding", adminOnly, async (_req: Request, res: Response) => {
  try {
    const branding = await getBrandingFromDbOrFile()
    const databaseName = getDatabaseName()
    res.json({
      systemName: branding.systemName,
      logoDataUrl: branding.logoDataUrl ?? undefined,
      systemSubtitle: branding.systemSubtitle ?? undefined,
      themeColor: branding.themeColor ?? undefined,
      databaseName: databaseName === "postgres" ? "" : databaseName,
      hideNewChatOnAdmin: branding.hideNewChatOnAdmin ?? false,
      hideAppsAllOnAdmin: branding.hideAppsAllOnAdmin ?? false,
      hideAssistantsAllOnAdmin: branding.hideAssistantsAllOnAdmin ?? false,
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

/**
 * PATCH /api/admin/settings/branding
 * Body: { system_name: string, logo_data_url?: string, system_subtitle?: string, theme_color?: string }. Updates file and app_settings. Does NOT change database name.
 */
router.patch("/branding", adminOnly, async (req: Request, res: Response) => {
  try {
    const { system_name, logo_data_url, system_subtitle, theme_color, hide_new_chat_on_admin, hide_apps_all_on_admin, hide_assistants_all_on_admin } = req.body ?? {}
    const systemName = typeof system_name === "string" ? system_name.trim() : ""
    if (!systemName) {
      return res.status(400).json({ error: "Tên hệ thống không được để trống." })
    }
    const logoDataUrl = typeof logo_data_url === "string" && logo_data_url.length > 0 ? logo_data_url : undefined
    const systemSubtitle = typeof system_subtitle === "string" ? system_subtitle.trim() : ""
    const themeColor = typeof theme_color === "string" && /^#[0-9A-Fa-f]{6}$/.test(theme_color.trim()) ? theme_color.trim() : ""
    const hideNewChatOnAdmin = hide_new_chat_on_admin === true || hide_new_chat_on_admin === "true"
    const hideAppsAllOnAdmin = hide_apps_all_on_admin === true || hide_apps_all_on_admin === "true"
    const hideAssistantsAllOnAdmin = hide_assistants_all_on_admin === true || hide_assistants_all_on_admin === "true"

    ensureDataDir()
    fs.writeFileSync(
      BRANDING_FILE,
      JSON.stringify({ systemName, logoDataUrl: logoDataUrl ?? null, systemSubtitle: systemSubtitle || null, themeColor: themeColor || null }, null, 2),
      "utf8"
    )
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('system_name', $1), ('logo_data_url', $2), ('system_subtitle', $3), ('theme_color', $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [systemName, logoDataUrl ?? "", systemSubtitle, themeColor]
    )
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES ('hide_new_chat_on_admin', $1), ('hide_apps_all_on_admin', $2), ('hide_assistants_all_on_admin', $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [hideNewChatOnAdmin ? "true" : "false", hideAppsAllOnAdmin ? "true" : "false", hideAssistantsAllOnAdmin ? "true" : "false"]
    )
    res.json({
      ok: true,
      systemName,
      logoDataUrl: logoDataUrl ?? undefined,
      systemSubtitle: systemSubtitle || undefined,
      themeColor: themeColor || undefined,
      hideNewChatOnAdmin,
      hideAppsAllOnAdmin,
      hideAssistantsAllOnAdmin,
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

/**
 * POST /api/admin/settings/switch-database
 * Switch database in use. Body: { databaseName: string }. Writes setup-db.json and resets pool.
 * If new database does not exist or has no schema, user goes to /setup to initialize.
 */
router.post("/switch-database", adminOnly, async (req: Request, res: Response) => {
  try {
    const raw = typeof req.body?.databaseName === "string" ? req.body.databaseName.trim().toLowerCase() : ""
    if (!raw || !DB_NAME_REGEX.test(raw)) {
      return res.status(400).json({
        error: "Tên database không hợp lệ.",
        message: "Chỉ dùng chữ thường, số và gạch dưới, tối đa 63 ký tự (ví dụ: ai_portal).",
      })
    }
    const current = getDatabaseName()
    if (current === raw) {
      return res.status(400).json({ error: "Đang dùng database này rồi.", message: "Chọn tên database khác." })
    }
    ensureDataDir()
    fs.writeFileSync(SETUP_DB_FILE, JSON.stringify({ databaseName: raw }, null, 2), "utf8")
    resetPool()
    res.json({ ok: true, databaseName: raw })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

/**
 * GET /api/admin/settings/sso
 * Returns which SSO providers are configured (for admin UI: show form for selected provider).
 */
router.get("/sso", adminOnly, async (_req: Request, res: Response) => {
  try {
    const googleClientId = getSetting("GOOGLE_CLIENT_ID") || ""
    const googleSecretSet = !!(getSetting("GOOGLE_CLIENT_SECRET") || "").trim()
    const azureClientId = getSetting("AZURE_AD_CLIENT_ID") || ""
    const azureTenantId = getSetting("AZURE_AD_TENANT_ID") || ""
    const azureSecretSet = !!(getSetting("AZURE_AD_CLIENT_SECRET") || "").trim()

    res.json({
      google: {
        clientId: googleClientId,
        clientSecretSet: googleSecretSet,
        configured: googleClientId.length > 0 && googleSecretSet,
      },
      azure: {
        clientId: azureClientId,
        tenantId: azureTenantId,
        clientSecretSet: azureSecretSet,
        configured:
          azureClientId.length > 0 && azureTenantId.length > 0 && azureSecretSet,
      },
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
