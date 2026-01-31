// routes/users.ts
import { Router, Request, Response } from "express"
import { query } from "../lib/db"

const router = Router()

/**
 * POST /api/users/ensure
 * Ensure a user exists in the database by email
 * Creates a new user if not exists, returns existing user ID if exists
 * 
 * Body: { email: string }
 * Response: { id: string }
 */
router.post("/ensure", async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email || typeof email !== "string") {
      return res.status(400).json({ 
        error: "Invalid request",
        message: "Email is required and must be a string"
      })
    }

    // Check if user exists
    const found = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (found.rowCount && found.rows[0]?.id) {
      return res.json({ id: found.rows[0].id })
    }

    // Create new user if not exists
    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO research_chat.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )

    // Fetch the created user (in case of conflict, get existing one)
    const finalCheck = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (finalCheck.rowCount && finalCheck.rows[0]?.id) {
      return res.json({ id: finalCheck.rows[0].id })
    }

    return res.status(500).json({ 
      error: "Failed to create or retrieve user" 
    })
  } catch (err: any) {
    console.error("POST /api/users/ensure error:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined
    })
  }
})

export default router
