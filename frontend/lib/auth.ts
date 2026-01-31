// lib/auth.ts
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

/**
 * Trích xuất userId từ token NextAuth.
 * - Nếu token có custom field userId → dùng.
 * - Nếu không thì fallback về token.sub.
 */
export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) return null

    const userId = (token as any).userId ?? token.sub
    return userId ?? null
}
