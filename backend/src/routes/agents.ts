// routes/agents.ts
import { Router, Request, Response } from "express"
import { getSetting } from "../lib/settings"

const router = Router()

// GET /api/agents/experts
router.get("/experts", async (req: Request, res: Response) => {
  try {
    const expertAgentUrl = getSetting("EXPERT_AGENT_URL", "http://localhost:8011/v1")
    const query = new URLSearchParams(req.query as Record<string, string>).toString()
    const response = await fetch(`${expertAgentUrl}/data?${query}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/agents/documents - Giữ cho tương thích ngược
// GET /api/agents/papers - Proxy đến paper agent (alias chính)
const paperAgentHandler = async (req: Request, res: Response) => {
  try {
    const paperAgentUrl = getSetting("PAPER_AGENT_URL", "http://localhost:8000/v1")
    const query = new URLSearchParams(req.query as Record<string, string>).toString()
    const response = await fetch(`${paperAgentUrl}/data?${query}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
router.get("/documents", paperAgentHandler)
router.get("/papers", paperAgentHandler)

// GET /api/agents/review
router.get("/review", async (req: Request, res: Response) => {
  try {
    const reviewAgentUrl = getSetting("REVIEW_AGENT_URL", "http://localhost:8007/api/v1")
    const query = new URLSearchParams(req.query as Record<string, string>).toString()
    const response = await fetch(`${reviewAgentUrl}/data?${query}`, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    })
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/agents/metadata - Backend fetch metadata từ các trợ lý
// Frontend sẽ gọi endpoint này thay vì gọi trực tiếp đến các trợ lý
router.get("/metadata", async (req: Request, res: Response) => {
  try {
    const { baseUrl } = req.query
    
    if (!baseUrl || typeof baseUrl !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'baseUrl' query parameter" })
    }

    // Xây dựng URL metadata
    const metadataUrl = `${baseUrl}/metadata`

    // Backend gọi đến trợ lý với timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 giây timeout

    try {
      const response = await fetch(metadataUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.warn(`⚠️ Failed to fetch metadata from ${metadataUrl}: ${response.status} ${response.statusText}`)
        return res.status(response.status).json({ 
          error: `Failed to fetch metadata: ${response.status} ${response.statusText}` 
        })
      }

      const data = await response.json()
      res.status(response.status).json(data)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      // Phân loại lỗi để trả về status code phù hợp
      if (fetchError.name === "AbortError" || fetchError.code === "ECONNABORTED") {
        console.warn(`⚠️ Timeout fetching metadata from ${metadataUrl}`)
        return res.status(504).json({ 
          error: "Timeout fetching metadata",
          message: `Request to ${metadataUrl} timed out after 10 seconds`
        })
      } else if (
        fetchError.code === "ECONNREFUSED" || 
        fetchError.code === "ENOTFOUND" ||
        fetchError.code === "ETIMEDOUT" ||
        fetchError.message?.includes("fetch failed") ||
        fetchError.message?.includes("ECONNREFUSED")
      ) {
        // Network errors - agent không thể truy cập được
        console.warn(`⚠️ Cannot connect to ${metadataUrl}: ${fetchError.code || fetchError.message}`)
        return res.status(502).json({ 
          error: "Cannot connect to agent",
          message: `Unable to reach ${baseUrl}. The agent may be offline or unreachable.`,
          code: fetchError.code || "NETWORK_ERROR"
        })
      } else {
        // Lỗi khác
        console.error(`⚠️ Error fetching metadata from ${metadataUrl}:`, {
          name: fetchError.name,
          message: fetchError.message,
          code: fetchError.code,
          stack: fetchError.stack
        })
        return res.status(500).json({ 
          error: "Failed to fetch metadata",
          message: fetchError.message || "Unknown error occurred"
        })
      }
    }
  } catch (error: any) {
    console.error("Metadata fetch error:", error)
    res.status(500).json({ 
      error: "Failed to fetch metadata",
      message: error.message || "Unknown error occurred"
    })
  }
})

export default router
