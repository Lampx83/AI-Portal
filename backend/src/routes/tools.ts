// routes/tools.ts – Apps API (data), separate from assistants
import { Router, Request, Response } from "express"
import { getToolConfigs, getToolByAlias, getAllTools } from "../lib/tools"
import { recordToolOpen } from "../lib/tool-usage"

const router = Router()

// GET /api/tools - List app configs (only is_active = true). ?full=1 returns full tool objects in one response (tránh N+1 request từ frontend).
router.get("/", async (req: Request, res: Response) => {
  try {
    const full = req.query.full === "1" || req.query.full === "true"
    if (full) {
      const configs = await getToolConfigs()
      const tools = await getAllTools(configs)
      const withPinned = tools.map((t, i) => ({
        ...t,
        pinned: !!configs[i]?.pinned,
        category_slug: t.category_slug ?? null,
        category_name: t.category_name ?? null,
      }))
      return res.json(withPinned)
    }
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

// GET /api/tools/:alias - One app full (with metadata)
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
