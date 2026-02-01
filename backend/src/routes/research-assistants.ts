// routes/research-assistants.ts
import { Router, Request, Response } from "express"
import {
  getResearchAssistantConfigs,
  getResearchAssistantByAlias,
} from "../lib/research-assistants"

const router = Router()

// GET /api/research-assistants - Lấy danh sách cấu hình các trợ lý (không fetch metadata)
router.get("/", async (req: Request, res: Response) => {
  try {
    // Lấy từ database thay vì hardcode
    const configs = await getResearchAssistantConfigs()
    res.json(configs)
  } catch (error: any) {
    console.error("Error fetching research assistant configs:", error)
    res.status(500).json({
      error: "Failed to fetch research assistant configs",
      message: error.message || "Unknown error occurred",
    })
  }
})

// GET /api/research-assistants/:alias - Lấy một trợ lý đầy đủ theo alias (có fetch metadata)
router.get("/:alias", async (req: Request, res: Response) => {
  try {
    const { alias } = req.params
    // Đảm bảo alias là string (Express params luôn là string cho route params)
    const aliasStr = typeof alias === "string" ? alias : Array.isArray(alias) ? alias[0] : ""
    
    if (!aliasStr) {
      return res.status(400).json({
        error: "Invalid alias parameter",
        message: "Alias parameter is required",
      })
    }
    
    const assistant = await getResearchAssistantByAlias(aliasStr)

    if (!assistant) {
      return res.status(404).json({
        error: "Assistant not found",
        message: `No assistant found with alias: ${aliasStr}`,
      })
    }

    res.json(assistant)
  } catch (error: any) {
    console.error(`Error fetching research assistant ${req.params.alias}:`, error)
    res.status(500).json({
      error: "Failed to fetch research assistant",
      message: error.message || "Unknown error occurred",
    })
  }
})

export default router
