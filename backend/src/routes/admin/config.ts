import { Router, Request, Response } from "express"
import path from "path"
import fs from "fs"
import { spawnSync } from "child_process"
import { query, getDatabaseName, resetPool } from "../../lib/db"
import { getRegulationsEmbeddingUrl, getQdrantUrl } from "../../lib/config"
import { loadRuntimeConfigFromDb, getAllowedKeys } from "../../lib/runtime-config"
import {
  getCentralAgentConfig,
  updateCentralAgentConfig,
  type CentralLlmProvider,
} from "../../lib/central-agent-config"
import { getSetting, getBootstrapEnv } from "../../lib/settings"
import { adminOnly } from "./middleware"
import { CONFIG_KEYS, PLACEHOLDER_VALUE_KEYS } from "./config-i18n"

const APP_SETTINGS_KEYS = [
  "guest_daily_message_limit",
  "default_locale",
  "plugin_qdrant_enabled",
  "qdrant_url",
  "projects_enabled",
] as const

const router = Router()

function addItemKeys<T extends { value: string }>(
  item: T & { descriptionKey: string; valueKey?: string; keyLabel?: string }
): T & { descriptionKey: string; valueKey?: string; keyLabel?: string } {
  const valueKey = PLACEHOLDER_VALUE_KEYS[item.value]
  return { ...item, ...(valueKey ? { valueKey } : {}) }
}

router.get("/config", adminOnly, async (req: Request, res: Response) => {
  try {
    const centralConfig = await getCentralAgentConfig()
    const port = getSetting("PORT", "3001")
    const mask = (set: boolean) => (set ? "••••••••" : "(chưa set)")
    const notSet = "(chưa set)"
    const sections = [
      {
        titleKey: CONFIG_KEYS.section.server,
        descriptionKey: CONFIG_KEYS.section.serverDesc,
        items: [
          addItemKeys({ key: "PORT", value: port, descriptionKey: CONFIG_KEYS.desc.PORT }),
          addItemKeys({ key: "NODE_ENV", value: getBootstrapEnv("NODE_ENV", "development"), descriptionKey: CONFIG_KEYS.desc.NODE_ENV }),
          addItemKeys({ key: "DEBUG", value: getSetting("DEBUG") || "false", descriptionKey: CONFIG_KEYS.desc.DEBUG }),
          addItemKeys({ key: "BACKEND_URL", value: getSetting("BACKEND_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.BACKEND_URL }),
          addItemKeys({ key: "API_BASE_URL", value: getSetting("API_BASE_URL") || "(mặc định)", descriptionKey: CONFIG_KEYS.desc.API_BASE_URL }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.frontend,
        items: [
          addItemKeys({ key: "NEXTAUTH_URL", value: getSetting("NEXTAUTH_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.NEXTAUTH_URL }),
          addItemKeys({ key: "FRONTEND_URL", value: getSetting("FRONTEND_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.FRONTEND_URL }),
          addItemKeys({ key: "NEXT_PUBLIC_API_BASE_URL", value: getSetting("NEXT_PUBLIC_API_BASE_URL") || "(trống = same-origin)", descriptionKey: CONFIG_KEYS.desc.NEXT_PUBLIC_API_BASE_URL }),
          addItemKeys({ key: "NEXT_PUBLIC_WS_URL", value: getSetting("NEXT_PUBLIC_WS_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.NEXT_PUBLIC_WS_URL }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.auth,
        items: [
          addItemKeys({ key: "NEXTAUTH_SECRET", value: mask(!!getSetting("NEXTAUTH_SECRET")), descriptionKey: CONFIG_KEYS.desc.NEXTAUTH_SECRET, secret: true }),
          addItemKeys({ key: "ADMIN_SECRET", value: mask(!!getSetting("ADMIN_SECRET")), descriptionKey: CONFIG_KEYS.desc.ADMIN_SECRET, secret: true }),
          addItemKeys({ key: "ADMIN_REDIRECT_PATH", value: getSetting("ADMIN_REDIRECT_PATH") || "(mặc định /admin)", descriptionKey: CONFIG_KEYS.desc.ADMIN_REDIRECT_PATH }),
          addItemKeys({ key: "AUTH_TRUST_HOST", value: getSetting("AUTH_TRUST_HOST") || "true", descriptionKey: CONFIG_KEYS.desc.AUTH_TRUST_HOST }),
          addItemKeys({ key: "AZURE_AD_CLIENT_ID", value: getSetting("AZURE_AD_CLIENT_ID") || notSet, descriptionKey: CONFIG_KEYS.desc.AZURE_AD_CLIENT_ID }),
          addItemKeys({ key: "AZURE_AD_CLIENT_SECRET", value: mask(!!getSetting("AZURE_AD_CLIENT_SECRET")), descriptionKey: CONFIG_KEYS.desc.AZURE_AD_CLIENT_SECRET, secret: true }),
          addItemKeys({ key: "AZURE_AD_TENANT_ID", value: getSetting("AZURE_AD_TENANT_ID") || notSet, descriptionKey: CONFIG_KEYS.desc.AZURE_AD_TENANT_ID }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.postgres,
        descriptionKey: CONFIG_KEYS.section.postgresDesc,
        items: [
          addItemKeys({ key: "POSTGRES_HOST", value: getBootstrapEnv("POSTGRES_HOST", notSet), descriptionKey: CONFIG_KEYS.desc.POSTGRES_HOST }),
          addItemKeys({ key: "POSTGRES_PORT", value: getBootstrapEnv("POSTGRES_PORT", "5432"), descriptionKey: CONFIG_KEYS.desc.POSTGRES_PORT }),
          addItemKeys({ key: "POSTGRES_DB", value: getBootstrapEnv("POSTGRES_DB", notSet), descriptionKey: CONFIG_KEYS.desc.POSTGRES_DB }),
          addItemKeys({ key: "POSTGRES_USER", value: getBootstrapEnv("POSTGRES_USER", notSet), descriptionKey: CONFIG_KEYS.desc.POSTGRES_USER }),
          addItemKeys({ key: "POSTGRES_PASSWORD", value: mask(!!getBootstrapEnv("POSTGRES_PASSWORD")), descriptionKey: CONFIG_KEYS.desc.POSTGRES_PASSWORD, secret: true }),
          addItemKeys({ key: "POSTGRES_SSL", value: getBootstrapEnv("POSTGRES_SSL", "false"), descriptionKey: CONFIG_KEYS.desc.POSTGRES_SSL }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.qdrant,
        items: [
          addItemKeys({ key: "QDRANT_URL", value: getQdrantUrl(), descriptionKey: CONFIG_KEYS.desc.QDRANT_URL }),
          addItemKeys({ key: "QDRANT_PORT", value: getSetting("QDRANT_PORT", "8010"), descriptionKey: CONFIG_KEYS.desc.QDRANT_PORT }),
          addItemKeys({ key: "QDRANT_EXTERNAL_URL", value: getSetting("QDRANT_EXTERNAL_URL") || getSetting("QDRANT_URL") || "(tự động từ QDRANT_URL)", descriptionKey: CONFIG_KEYS.desc.QDRANT_EXTERNAL_URL }),
          addItemKeys({ key: "REGULATIONS_EMBEDDING_URL", value: getRegulationsEmbeddingUrl(), descriptionKey: CONFIG_KEYS.desc.REGULATIONS_EMBEDDING_URL }),
          addItemKeys({ key: "REGULATIONS_EMBEDDING_MODEL", value: getSetting("REGULATIONS_EMBEDDING_MODEL", "text-embedding-3-small"), descriptionKey: CONFIG_KEYS.desc.REGULATIONS_EMBEDDING_MODEL }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.minio,
        items: [
          addItemKeys({ key: "MINIO_ENDPOINT", value: getSetting("MINIO_ENDPOINT", "localhost"), descriptionKey: CONFIG_KEYS.desc.MINIO_ENDPOINT }),
          addItemKeys({ key: "MINIO_PORT", value: getSetting("MINIO_PORT", "9000"), descriptionKey: CONFIG_KEYS.desc.MINIO_PORT }),
          addItemKeys({ key: "MINIO_ENDPOINT_PUBLIC", value: getSetting("MINIO_ENDPOINT_PUBLIC") || getSetting("MINIO_ENDPOINT") || "(cùng MINIO_ENDPOINT)", descriptionKey: CONFIG_KEYS.desc.MINIO_ENDPOINT_PUBLIC }),
          addItemKeys({ key: "MINIO_BUCKET_NAME", value: getSetting("MINIO_BUCKET_NAME", "portal"), descriptionKey: CONFIG_KEYS.desc.MINIO_BUCKET_NAME }),
          addItemKeys({ key: "MINIO_ACCESS_KEY", value: mask(!!getSetting("MINIO_ACCESS_KEY")), descriptionKey: CONFIG_KEYS.desc.MINIO_ACCESS_KEY, secret: true }),
          addItemKeys({ key: "MINIO_SECRET_KEY", value: mask(!!getSetting("MINIO_SECRET_KEY")), descriptionKey: CONFIG_KEYS.desc.MINIO_SECRET_KEY, secret: true }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.agents,
        items: [
          addItemKeys({ key: "PAPER_AGENT_URL", value: getSetting("PAPER_AGENT_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.PAPER_AGENT_URL }),
          addItemKeys({ key: "EXPERT_AGENT_URL", value: getSetting("EXPERT_AGENT_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.EXPERT_AGENT_URL }),
          addItemKeys({ key: "REVIEW_AGENT_URL", value: getSetting("REVIEW_AGENT_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.REVIEW_AGENT_URL }),
          addItemKeys({ key: "PLAGIARISM_AGENT_URL", value: getSetting("PLAGIARISM_AGENT_URL") || notSet, descriptionKey: CONFIG_KEYS.desc.PLAGIARISM_AGENT_URL }),
        ],
      },
      {
        titleKey: CONFIG_KEYS.section.openai,
        descriptionKey: CONFIG_KEYS.section.openaiDesc,
        items: [
          addItemKeys({
            key: "central_llm",
            keyLabel: CONFIG_KEYS.item.centralLlm,
            value: centralConfig.provider === "skip" ? "Bỏ qua" : `${centralConfig.provider} / ${centralConfig.model || "(chưa nhập model)"}`,
            descriptionKey: CONFIG_KEYS.desc.central_llm,
            secret: false,
          }),
          addItemKeys({ key: "SERPAPI_KEY", value: mask(!!getSetting("SERPAPI_KEY")), descriptionKey: CONFIG_KEYS.desc.SERPAPI_KEY, secret: true }),
          addItemKeys({ key: "CORS_ORIGIN", value: getSetting("CORS_ORIGIN", "http://localhost:3000,http://localhost:3002"), descriptionKey: CONFIG_KEYS.desc.CORS_ORIGIN }),
          addItemKeys({ key: "PRIMARY_DOMAIN", value: getSetting("PRIMARY_DOMAIN", "your-domain.com"), descriptionKey: CONFIG_KEYS.desc.PRIMARY_DOMAIN }),
          addItemKeys({ key: "RUNNING_IN_DOCKER", value: getSetting("RUNNING_IN_DOCKER", "false"), descriptionKey: CONFIG_KEYS.desc.RUNNING_IN_DOCKER }),
          addItemKeys({ key: "ADMIN_EMAILS", value: getSetting("ADMIN_EMAILS") || notSet, descriptionKey: CONFIG_KEYS.desc.ADMIN_EMAILS }),
        ],
      },
    ]
    res.json({ sections })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.post("/config", adminOnly, async (req: Request, res: Response) => {
  try {
    const updates = req.body?.updates as Record<string, string> | undefined
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ error: "Body must include updates: { key: value, ... }" })
    }
    const allowed = getAllowedKeys()
    for (const key of Object.keys(updates)) {
      if (!allowed.has(key)) continue
      const value = updates[key] == null ? "" : String(updates[key])
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value.trim()]
      )
    }
    await loadRuntimeConfigFromDb()
    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.get("/app-settings", adminOnly, async (req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [APP_SETTINGS_KEYS as unknown as string[]]
    )
    const map: Record<string, string> = {}
    for (const r of rows.rows as { key: string; value: string }[]) {
      map[r.key] = r.value ?? ""
    }
    const guestLimit = parseInt(map.guest_daily_message_limit ?? "1", 10)
    res.json({
      guest_daily_message_limit: Number.isInteger(guestLimit) && guestLimit >= 0 ? guestLimit : 1,
      default_locale: (map.default_locale || "en").trim() || "en",
      plugin_qdrant_enabled: map.plugin_qdrant_enabled === "true",
      qdrant_url: (map.qdrant_url || "").trim(),
      projects_enabled: map.projects_enabled !== "false",
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.patch("/app-settings", adminOnly, async (req: Request, res: Response) => {
  try {
    const { guest_daily_message_limit, default_locale, plugin_qdrant_enabled, qdrant_url, projects_enabled } =
      req.body ?? {}
    if (guest_daily_message_limit !== undefined) {
      const n = Number(guest_daily_message_limit)
      if (!Number.isInteger(n) || n < 0) {
        return res.status(400).json({ errorCode: "guest_limit_invalid" })
      }
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ('guest_daily_message_limit', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [String(n)]
      )
    }
    if (default_locale !== undefined) {
      const loc = String(default_locale).trim().toLowerCase()
      if (loc.length >= 2 && loc.length <= 20 && /^[a-z0-9]+$/.test(loc)) {
        await query(
          `INSERT INTO ai_portal.app_settings (key, value) VALUES ('default_locale', $1)
           ON CONFLICT (key) DO UPDATE SET value = $1`,
          [loc]
        )
      }
    }
    if (plugin_qdrant_enabled !== undefined) {
      const v = plugin_qdrant_enabled === true || plugin_qdrant_enabled === "true" ? "true" : "false"
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ('plugin_qdrant_enabled', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [v]
      )
    }
    if (qdrant_url !== undefined) {
      const url = String(qdrant_url ?? "").trim()
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ('qdrant_url', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [url]
      )
    }
    if (projects_enabled !== undefined) {
      const v = projects_enabled === true || projects_enabled === "true" ? "true" : "false"
      await query(
        `INSERT INTO ai_portal.app_settings (key, value) VALUES ('projects_enabled', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`,
        [v]
      )
    }
    if (plugin_qdrant_enabled !== undefined || qdrant_url !== undefined) {
      await loadRuntimeConfigFromDb()
    }
    const rows = await query(
      `SELECT key, value FROM ai_portal.app_settings WHERE key = ANY($1::text[])`,
      [APP_SETTINGS_KEYS as unknown as string[]]
    )
    const map: Record<string, string> = {}
    for (const r of rows.rows as { key: string; value: string }[]) {
      map[r.key] = r.value ?? ""
    }
    const guestLimit = parseInt(map.guest_daily_message_limit ?? "1", 10)
    res.json({
      guest_daily_message_limit: Number.isInteger(guestLimit) && guestLimit >= 0 ? guestLimit : 1,
      default_locale: (map.default_locale || "en").trim() || "en",
      plugin_qdrant_enabled: map.plugin_qdrant_enabled === "true",
      qdrant_url: (map.qdrant_url || "").trim(),
      projects_enabled: map.projects_enabled !== "false",
    })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.get("/central-agent-config", adminOnly, async (_req: Request, res: Response) => {
  try {
    const config = await getCentralAgentConfig()
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.patch("/central-agent-config", adminOnly, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {}
    const allowed: CentralLlmProvider[] = ["openai", "gemini", "anthropic", "openai_compatible", "skip"]
    const provider = allowed.includes(body.provider) ? (body.provider as CentralLlmProvider) : undefined
    const model = typeof body.model === "string" ? body.model.trim() : undefined
    // Only send api_key when it has a value (do not send empty string to avoid clearing saved key)
    const api_key =
      typeof body.api_key === "string" && body.api_key.trim() !== ""
        ? body.api_key.trim()
        : undefined
    const base_url =
      typeof body.base_url === "string" && body.base_url.trim() !== ""
        ? body.base_url.trim()
        : undefined
    const config = await updateCentralAgentConfig({ provider, model, api_key, base_url })
    res.json(config)
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err?.message })
  }
})

router.post("/settings/reset-database", adminOnly, async (req: Request, res: Response) => {
  try {
    const { confirm: confirmValue } = req.body ?? {}
    if (confirmValue !== "RESET") {
      return res.status(400).json({ errorCode: "reset_confirm_required" })
    }

    const database = getDatabaseName()
    if (database === "postgres") {
      return res.status(400).json({ errorCode: "reset_no_database" })
    }

    // Drop entire ai_portal schema (tables, data) — no DROP DATABASE so it still works with other connections (pgAdmin, etc.)
    await query("DROP SCHEMA IF EXISTS ai_portal CASCADE")

    // Close pool so next connection sees the new schema
    resetPool()

    const host = getBootstrapEnv("POSTGRES_HOST", "localhost")
    const port = Number(getBootstrapEnv("POSTGRES_PORT", "5432"))
    const user = getBootstrapEnv("POSTGRES_USER", "postgres")
    const password = getBootstrapEnv("POSTGRES_PASSWORD", "") || "postgres"
    const backendRoot = path.join(__dirname, "..", "..", "..")
    const schemaPath = path.join(backendRoot, "schema.sql")
    if (!fs.existsSync(schemaPath)) {
      return res.status(500).json({ errorCode: "reset_schema_not_found", schemaPath })
    }

    const result = spawnSync(
      "psql",
      ["-h", host, "-p", String(port), "-d", database, "-U", user, "-f", schemaPath, "-v", "ON_ERROR_STOP=1"],
      {
        encoding: "utf8",
        env: { ...process.env, PGPASSWORD: password },
        timeout: 120_000,
      }
    )
    if (result.error) {
      return res.status(503).json({ errorCode: "reset_psql_failed", message: result.error.message, database })
    }
    if (result.status !== 0) {
      return res.status(500).json({
        errorCode: "reset_schema_error",
        message: result.stderr || result.stdout || String(result.status),
      })
    }

    res.json({ ok: true, messageKey: "admin.settings.resetDoneMessage" })
  } catch (err: any) {
    console.error("POST /api/admin/settings/reset-database error:", err)
    res.status(500).json({ errorCode: "reset_failed", message: err?.message ?? String(err) })
  }
})

router.get("/projects", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT p.id, p.user_id, p.name, p.description, p.team_members, p.file_keys, p.created_at, p.updated_at,
             u.email AS user_email, u.display_name AS user_display_name, u.full_name AS user_full_name
      FROM ai_portal.projects p
      JOIN ai_portal.users u ON u.id = p.user_id
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
    `)
    const projects = result.rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      user_id: r.user_id,
      name: r.name,
      description: r.description,
      team_members: r.team_members ?? [],
      file_keys: r.file_keys ?? [],
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_email: r.user_email,
      user_display_name: r.user_display_name,
      user_full_name: r.user_full_name,
    }))
    res.json({ projects })
  } catch (err: any) {
    console.error("Error fetching projects:", err)
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    })
  }
})

export default router
