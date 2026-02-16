// lib/chat/user.ts
import type { Request } from "express"
import crypto from "crypto"
import { query } from "../db"
import { parseCookies } from "../parse-cookies"
import { getSetting } from "../settings"
import { UUID_RE, SYSTEM_USER_ID } from "./constants"

/** Get current user ID from JWT (NextAuth) in request. Returns null if not logged in. */
export async function getCurrentUserId(req: Request): Promise<string | null> {
  const { getToken } = await import("next-auth/jwt")
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const cookies = parseCookies(req.headers.cookie)
  const token = await getToken({
    req: { cookies, headers: req.headers } as any,
    secret,
  })
  return (token as { id?: string })?.id ?? null
}

/** Resolve user UUID: valid UUID returns as-is; email finds or creates user. Fallback: SYSTEM_USER_ID on error or null/empty. */
export async function getOrCreateUserByEmail(email: string | null): Promise<string> {
  if (!email) {
    return SYSTEM_USER_ID
  }

  if (UUID_RE.test(email)) {
    return email
  }

  try {
    const found = await query(
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (found.rowCount && found.rows[0]?.id) {
      return found.rows[0].id
    }

    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO ai_portal.users (id, email, display_name, created_at, updated_at) 
       VALUES ($1::uuid, $2, $3, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )

    const finalCheck = await query(
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
      [email]
    )

    if (finalCheck.rowCount && finalCheck.rows[0]?.id) {
      return finalCheck.rows[0].id
    }
  } catch (err: any) {
    console.error("❌ Failed to get or create user by email:", err)
    console.error("   Email:", email)
  }

  return SYSTEM_USER_ID
}
