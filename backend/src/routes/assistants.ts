// routes/assistants.ts
import { Router, Request, Response } from "express"
import {
  getAssistantConfigs,
  getAssistantByAlias,
  getEmbedConfigByAlias,
} from "../lib/assistants"
import { getEmbedConfigByAlias as getToolEmbedConfig, getToolByAlias } from "../lib/tools"

const router = Router()

// GET /api/assistants/embed-config/:alias - Cấu hình domain cho phép nhúng (public, dùng cho CSP)
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
    res.json(config)
  } catch (error: any) {
    console.error("Error fetching embed config:", error)
    res.status(500).json({ error: "Failed to fetch embed config", message: error?.message })
  }
})

// GET /api/assistants - Lấy danh sách cấu hình các trợ lý (không fetch metadata)
router.get("/", async (req: Request, res: Response) => {
  try {
    const configs = await getAssistantConfigs()
    res.json(configs)
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

    res.json(assistant)
  } catch (error: any) {
    console.error(`Error fetching assistant ${req.params.alias}:`, error)
    res.status(500).json({
      error: "Failed to fetch assistant",
      message: error.message || "Unknown error occurred",
    })
  }
})

export default router
