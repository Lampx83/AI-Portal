// routes/tools.ts – API công cụ (write, data), tách khỏi trợ lý
import { Router, Request, Response } from "express"
import { getToolConfigs, getToolByAlias } from "../lib/tools"

const router = Router()

// GET /api/tools - Danh sách cấu hình công cụ (chỉ is_active = true)
router.get("/", async (req: Request, res: Response) => {
  try {
    const configs = await getToolConfigs()
    res.json(configs)
  } catch (error: unknown) {
    console.error("GET /api/tools error:", error)
    res.status(500).json({
      error: "Failed to fetch tool configs",
      message: (error as Error)?.message || "Unknown error",
    })
  }
})

// GET /api/tools/:alias - Một công cụ đầy đủ (có metadata)
router.get("/:alias", async (req: Request, res: Response) => {
  try {
    const alias = typeof req.params.alias === "string" ? req.params.alias : (req.params.alias as string[])?.[0] ?? ""
    if (!alias) {
      return res.status(400).json({ error: "Invalid alias" })
    }
    const tool = await getToolByAlias(alias)
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

export default router
