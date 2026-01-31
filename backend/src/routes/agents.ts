// routes/agents.ts
import { Router, Request, Response } from "express"

const router = Router()

// GET /api/agents/experts
router.get("/experts", async (req: Request, res: Response) => {
  try {
    const query = new URLSearchParams(req.query as Record<string, string>).toString()
    const response = await fetch(`http://localhost:8011/v1/data?${query}`, {
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

// GET /api/agents/documents
router.get("/documents", async (req: Request, res: Response) => {
  try {
    const query = new URLSearchParams(req.query as Record<string, string>).toString()
    const response = await fetch(`http://localhost:8000/v1/data?${query}`, {
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

// GET /api/agents/review
router.get("/review", async (req: Request, res: Response) => {
  try {
    const query = new URLSearchParams(req.query as Record<string, string>).toString()
    const response = await fetch(`http://localhost:8007/api/v1/data?${query}`, {
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

export default router
