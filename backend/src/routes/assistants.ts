// routes/assistants.ts
import { Router, Request, Response } from "express"
import {
  getAssistantConfigs,
  getAssistantByAlias,
  getEmbedConfigByAlias,
} from "../lib/assistants"
import { getEmbedConfigByAlias as getToolEmbedConfig, getToolByAlias } from "../lib/tools"
import { publicAssistantBaseUrl } from "../lib/assistants"
import { getCaller } from "../lib/chat/access"

/** Origin công khai của request (qua nginx/gateway) — chỉ dùng làm tiền tố cho tham chiếu trợ lý. */
function requestOrigin(req: Request): string {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim()
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim()
  return `${proto}://${host}`
}

const router = Router()

// GET /api/assistants/embed-config/:alias - Embed allowed domain config (public, for CSP)
router.get("/embed-config/:alias", async (req: Request, res: Response) => {
  try {
    const alias = typeof req.params.alias === "string" ? req.params.alias : (req.params.alias as string[])?.[0] ?? ""
    if (!alias) {
      return res.status(400).json({ error: "Invalid alias" })
    }
    const config = (await getEmbedConfigByAlias(alias)) ?? (await getToolEmbedConfig(alias))
    if (!config) {
      return res.status(404).json({ error: "Agent not found" })
    }
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600")
    res.json(config)
  } catch (error: any) {
    console.error("Error fetching embed config:", error)
    res.status(500).json({ error: "Failed to fetch embed config", message: error?.message })
  }
})

// GET /api/assistants - List assistant configs (no metadata fetch)
router.get("/", async (req: Request, res: Response) => {
  try {
    const configs = await getAssistantConfigs()
    // BẢO MẬT: người không phải admin không được biết địa chỉ nội bộ của agent.
    const caller = await getCaller(req)
    res.setHeader("Vary", "Cookie")
    if (caller.isAdmin) {
      res.setHeader("Cache-Control", "private, no-store")
      return res.json(configs)
    }
    const origin = requestOrigin(req)
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
    res.json(configs.map((c) => ({ ...c, baseUrl: publicAssistantBaseUrl(c.alias, String(c.baseUrl ?? ""), origin) })))
  } catch (error: any) {
    console.error("Error fetching assistant configs:", error)
    res.status(500).json({
      error: "Failed to fetch assistant configs",
      message: error.message || "Unknown error occurred",
    })
  }
})

// GET /api/assistants/:alias - Get one assistant or app by alias (with metadata fetch)
router.get("/:alias", async (req: Request, res: Response) => {
  try {
    const { alias } = req.params
    const aliasStr = typeof alias === "string" ? alias : Array.isArray(alias) ? alias[0] : ""

    if (!aliasStr) {
      return res.status(400).json({
        error: "Invalid alias parameter",
        message: "Alias parameter is required",
      })
    }

    let assistant = await getAssistantByAlias(aliasStr)
    if (!assistant) {
      const tool = await getToolByAlias(aliasStr)
      if (tool && tool.baseUrl)
        assistant = { ...tool, baseUrl: tool.baseUrl, icon: tool.icon as string } as import("../lib/assistants").Assistant
    }
    if (!assistant) {
      return res.status(404).json({
        error: "Assistant not found",
        message: `No assistant found with alias: ${aliasStr}`,
      })
    }
    const caller = await getCaller(req)
    res.setHeader("Vary", "Cookie")
    if (caller.isAdmin) {
      res.setHeader("Cache-Control", "private, no-store")
      return res.json(assistant)
    }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
    res.json({ ...assistant, baseUrl: publicAssistantBaseUrl(String(assistant.alias ?? aliasStr), String(assistant.baseUrl ?? ""), requestOrigin(req)) })
  } catch (error: any) {
    console.error(`Error fetching assistant ${req.params.alias}:`, error)
    res.status(500).json({
      error: "Failed to fetch assistant",
      message: error.message || "Unknown error occurred",
    })
  }
})

export default router
