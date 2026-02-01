/**
 * NextAuth API route - chạy trên backend để Nginx/proxy route /api/auth/* đúng.
 * Dùng NextAuthApiHandler (Pages Router style): nhận (req, res) giống Express, không dùng next/headers.
 */
import { Router, Request as ExpressRequest, Response as ExpressResponse } from "express"
import NextAuth from "next-auth"
import { getToken } from "next-auth/jwt"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { query as dbQuery } from "../lib/db"

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return Object.fromEntries(
    cookieHeader.split(";").map((s) => {
      const i = s.indexOf("=")
      const key = decodeURIComponent(s.slice(0, i).trim())
      const value = decodeURIComponent(s.slice(i + 1).trim().replace(/^"|"$/g, ""))
      return [key, value]
    })
  )
}

async function ensureUserUuidByEmail(email?: string | null): Promise<string | null> {
  if (!email) return null
  try {
    const found = await dbQuery(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )
    if (found.rowCount && found.rows[0]?.id) return found.rows[0].id as string

    const newId = crypto.randomUUID()
    await dbQuery(
      `INSERT INTO research_chat.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )
    const finalCheck = await dbQuery(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )
    if (finalCheck.rowCount && finalCheck.rows[0]?.id) return finalCheck.rows[0].id as string
    return null
  } catch (err: any) {
    console.error("ensureUserUuidByEmail error:", err)
    return null
  }
}

function isValidGuid(value: string | undefined): boolean {
  if (!value) return false
  const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return guidRegex.test(value)
}

const azureAdConfig = {
  clientId: process.env.AZURE_AD_CLIENT_ID,
  clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  tenantId: process.env.AZURE_AD_TENANT_ID,
}

const providers: any[] = []
if (
  azureAdConfig.clientId &&
  azureAdConfig.clientSecret &&
  azureAdConfig.tenantId &&
  isValidGuid(azureAdConfig.clientId) &&
  isValidGuid(azureAdConfig.tenantId)
) {
  providers.push(
    AzureADProvider({
      clientId: azureAdConfig.clientId,
      clientSecret: azureAdConfig.clientSecret,
      tenantId: azureAdConfig.tenantId,
    })
  )
  console.log("✅ Backend: Azure AD provider enabled")
}

// NextAuth types thiếu trustHost / Session.user.id; dùng type assertion để build pass
const nextAuthOptions = {
  trustHost: true,
  providers: [
    ...providers,
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email?.trim()) return null
        const email = String(credentials.email).trim().toLowerCase()
        const password = credentials.password ?? ""
        const { verifyPassword } = await import("../lib/password")
        const found = await dbQuery(
          `SELECT id, display_name, password_hash FROM research_chat.users WHERE email = $1 LIMIT 1`,
          [email]
        )
        if (!found.rows[0]) return null
        const row = found.rows[0] as { id: string; display_name: string | null; password_hash: string | null }
        if (!row.password_hash) return null
        if (!verifyPassword(password, row.password_hash)) return null
        await dbQuery(
          `UPDATE research_chat.users SET last_login_at = now() WHERE id = $1::uuid`,
          [row.id]
        )
        return { id: row.id, name: row.display_name ?? email.split("@")[0], email }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, account, profile }: {
      token: Record<string, unknown>; user?: { id?: string; email?: string | null }; account?: { provider?: string; providerAccountId?: string; access_token?: string }; profile?: { sub?: string; oid?: string };
    }) {
      if (user) {
        // SSO (Azure AD, etc.): user.id là OID của provider, không phải DB id. Phải tra DB theo email.
        const isSSO = account?.provider && account.provider !== "credentials"
        const uid = isSSO
          ? ((await ensureUserUuidByEmail(user.email)) ?? user.id ?? "00000000-0000-0000-0000-000000000000")
          : (user.id ?? (await ensureUserUuidByEmail(user.email)) ?? "00000000-0000-0000-0000-000000000000")
        token.id = uid
        token.provider = account?.provider ?? token.provider
        token.profile = profile ?? token.profile
        try {
          const ssoSubject = (profile as { sub?: string; oid?: string })?.sub ?? (profile as { sub?: string; oid?: string })?.oid ?? account?.providerAccountId ?? ""
          if (isSSO && ssoSubject) {
            await dbQuery(
              `UPDATE research_chat.users SET sso_provider = $1, sso_subject = $2, last_login_at = now(), updated_at = now() WHERE id = $3::uuid`,
              [account!.provider, ssoSubject, uid]
            )
          } else {
            await dbQuery(
              `UPDATE research_chat.users SET last_login_at = now() WHERE id = $1::uuid`,
              [uid]
            )
          }
        } catch (_) {}
      }
      if (token.id) {
        try {
          const r = await dbQuery(
            `SELECT is_admin FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
            [token.id]
          )
          token.is_admin = !!r.rows[0]?.is_admin
        } catch {
          token.is_admin = false
        }
      }
      if (account?.access_token) token.accessToken = account.access_token
      return token
    },
    async session({ session, token }: { session: Record<string, unknown> & { user?: { id?: string; image?: string | null } }; token: Record<string, unknown> }) {
      (session as Record<string, unknown>).accessToken = token.accessToken as string
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id as string
        ;(session.user as Record<string, unknown>).profile = token.profile
        ;(session.user as Record<string, unknown>).provider = token.provider as string
        session.user.image = (token.picture as string | null) ?? session.user.image ?? null
        // Luôn lấy is_admin mới nhất từ DB mỗi lần trả session (để cập nhật quyền không cần đăng xuất)
        const userId = token.id as string
        if (userId) {
          try {
            const r = await dbQuery(
              `SELECT is_admin FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
              [userId]
            )
            ;(session.user as Record<string, unknown>).is_admin = !!r.rows[0]?.is_admin
          } catch {
            ;(session.user as Record<string, unknown>).is_admin = !!token.is_admin
          }
        } else {
          ;(session.user as Record<string, unknown>).is_admin = !!token.is_admin
        }
      }
      return session
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      try {
        const urlObj = new URL(url)
        const baseUrlObj = new URL(baseUrl)
        if (urlObj.origin === baseUrlObj.origin) return url
        return `${baseUrl}${urlObj.pathname}${urlObj.search}`
      } catch {
        return `${baseUrl}/assistants/main`
      }
    },
  },
}

const nextAuthHandler = NextAuth(nextAuthOptions as any)

const router = Router()

/**
 * Trích path sau /auth/ (hỗ trợ cả /api/auth/... và /auth/... khi proxy strip /api).
 */
function getPathAfterAuth(originalUrl: string): string {
  const match = originalUrl.match(/^(?:\/api)?\/auth\/?(.*?)(?:\?|$)/)
  return (match?.[1] ?? "").trim()
}

/**
 * Gọi NextAuthApiHandler (Pages Router): req.query có nextauth từ path, req.cookies từ Cookie header.
 * Không dùng NextAuthRouteHandler để tránh next/headers (chỉ chạy trong Next.js).
 */
async function handleNextAuth(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.NEXTAUTH_SECRET) {
    console.error("[auth] NEXTAUTH_SECRET is not set in production")
    res.status(503).json({
      error: "Server configuration error",
      message: "NEXTAUTH_SECRET is not set. Set NEXTAUTH_SECRET in the backend environment (e.g. GitHub Actions secrets or server .env).",
    })
    return
  }

  const pathAfterAuth = getPathAfterAuth(req.originalUrl)
  const nextauth = pathAfterAuth ? pathAfterAuth.split("/").filter(Boolean) : []
  const cookies = parseCookies(req.headers.cookie)

  // GET /api/auth/admin-check — trả về is_admin theo session (dùng khi session.user.is_admin không có)
  if (req.method === "GET" && nextauth[0] === "admin-check") {
    try {
      const token = await getToken({
        req: { cookies, headers: req.headers } as any,
        secret: process.env.NEXTAUTH_SECRET,
      })
      const userId = (token as { id?: string })?.id
      const userEmail = (token as { email?: string })?.email as string | undefined
      // DEBUG: log để tìm nguyên nhân menu "Trang quản trị" không hiện
      console.log("[auth] admin-check:", {
        hasToken: !!token,
        userId: userId ?? "(none)",
        userEmail: userEmail ?? "(none)",
        cookieHeader: req.headers.cookie ? "present" : "missing",
      })
      let is_admin = false
      if (userId) {
        const r = await dbQuery(
          `SELECT is_admin FROM research_chat.users WHERE id = $1::uuid LIMIT 1`,
          [userId]
        )
        is_admin = !!r.rows[0]?.is_admin
        console.log("[auth] admin-check by id:", { userId, row: r.rows[0], is_admin })
      }
      // Fallback: nếu tra theo id không có (SSO có token.id = Azure OID), tra theo email
      if (!is_admin && userEmail) {
        const r2 = await dbQuery(
          `SELECT is_admin FROM research_chat.users WHERE email = $1 LIMIT 1`,
          [userEmail]
        )
        is_admin = !!r2.rows[0]?.is_admin
        console.log("[auth] admin-check by email fallback:", { userEmail, row: r2.rows[0], is_admin })
      }
      console.log("[auth] admin-check result:", { is_admin })
      res.status(200).json({ is_admin })
      return
    } catch (err: any) {
      console.error("[auth] admin-check error:", err?.message ?? err)
      res.status(200).json({ is_admin: false })
      return
    }
  }

  const query = { ...(req.query as Record<string, string | string[] | undefined>), nextauth }

  // Đảm bảo NextAuth có origin đúng: set X-Forwarded-Host/Proto từ NEXTAUTH_URL
  // (tránh redirect_uri https://undefined khi proxy không gửi header hoặc AUTH_TRUST_HOST=true)
  const baseUrl = process.env.NEXTAUTH_URL || "https://research.neu.edu.vn"
  let originHost = baseUrl
  let originProto = "https"
  try {
    const u = new URL(baseUrl)
    originHost = u.host
    originProto = u.protocol.replace(":", "")
  } catch {
    originHost = "research.neu.edu.vn"
  }
  const headers = {
    ...(req.headers as Record<string, string | string[] | undefined>),
    "x-forwarded-host": originHost,
    "x-forwarded-proto": originProto,
  }

  const reqForAuth = {
    ...req,
    query,
    cookies,
    headers,
  }

  try {
    await nextAuthHandler(reqForAuth, res)
  } catch (err: any) {
    console.error("[auth] NextAuth handler error:", err?.code ?? err?.name, err?.message ?? err)
    res.status(500).json({
      error: "Internal Server Error",
      ...(process.env.NODE_ENV === "development" && { detail: err?.message }),
    })
  }
}

router.all("*", (req: ExpressRequest, res: ExpressResponse) => handleNextAuth(req, res))

export default router
