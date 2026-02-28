// routes/agents.ts
import { Router, Request, Response } from "express"
import { getSetting } from "../lib/settings"

const router = Router()

// GET /api/agents/experts
router.get("/experts", async (req: Request, res: Response) => {
  try {
    const expertAgentUrl = getSetting("EXPERT_AGENT_URL", "")
    if (!expertAgentUrl) {
      return res.status(503).json({ error: "Expert agent not configured (EXPERT_AGENT_URL)" })
    }
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

// GET /api/agents/documents - Kept for backward compatibility
// GET /api/agents/papers - Proxy to paper agent (main alias)
const paperAgentHandler = async (req: Request, res: Response) => {
  try {
    const paperAgentUrl = getSetting("PAPER_AGENT_URL", "")
    if (!paperAgentUrl) {
      return res.status(503).json({ error: "Paper agent not configured (PAPER_AGENT_URL)" })
    }
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
    const reviewAgentUrl = getSetting("REVIEW_AGENT_URL", "")
    if (!reviewAgentUrl) {
      return res.status(503).json({ error: "Review agent not configured (REVIEW_AGENT_URL)" })
    }
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

// GET /api/agents/metadata - Backend fetches metadata from assistants
// Frontend calls this endpoint instead of calling assistants directly
router.get("/metadata", async (req: Request, res: Response) => {
  try {
    const { baseUrl } = req.query
    
    if (!baseUrl || typeof baseUrl !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'baseUrl' query parameter" })
    }

    // Build metadata URL
    const metadataUrl = `${baseUrl}/metadata`

    // Backend calls assistant with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

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
      
      // Classify error to return appropriate status code
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
        // Network errors - agent unreachable
        console.warn(`⚠️ Cannot connect to ${metadataUrl}: ${fetchError.code || fetchError.message}`)
        return res.status(502).json({ 
          error: "Cannot connect to agent",
          message: `Unable to reach ${baseUrl}. The agent may be offline or unreachable.`,
          code: fetchError.code || "NETWORK_ERROR"
        })
      } else {
        // Other errors
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
