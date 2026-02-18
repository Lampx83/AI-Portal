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
import { isAlwaysAdmin } from "../lib/admin-utils"
import { getSetting, getBootstrapEnv } from "../lib/settings"

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
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
      [email]
    )
    if (found.rowCount && found.rows[0]?.id) return found.rows[0].id as string

    const newId = crypto.randomUUID()
    await dbQuery(
      `INSERT INTO ai_portal.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )
    const finalCheck = await dbQuery(
      `SELECT id FROM ai_portal.users WHERE email = $1 LIMIT 1`,
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

function getAzureProvider(): any {
  const clientId = getSetting("AZURE_AD_CLIENT_ID")
  const clientSecret = getSetting("AZURE_AD_CLIENT_SECRET")
  const tenantId = getSetting("AZURE_AD_TENANT_ID")
  if (!clientId || !clientSecret || !tenantId || !isValidGuid(clientId) || !isValidGuid(tenantId)) return null
  return AzureADProvider({ clientId, clientSecret, tenantId })
}

function getNextAuthOptions() {
  const providers: any[] = []
  const azure = getAzureProvider()
  if (azure) providers.push(azure)
  return {
    trustHost: getSetting("AUTH_TRUST_HOST") !== "false",
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
          `SELECT id, display_name, password_hash FROM ai_portal.users WHERE email = $1 LIMIT 1`,
          [email]
        )
        if (!found.rows[0]) return null
        const row = found.rows[0] as { id: string; display_name: string | null; password_hash: string | null }
        if (!row.password_hash) return null
        if (!verifyPassword(password, row.password_hash)) return null
        await dbQuery(
          `UPDATE ai_portal.users SET last_login_at = now() WHERE id = $1::uuid`,
          [row.id]
        )
        return { id: row.id, name: row.display_name ?? email.split("@")[0], email }
      },
    }),
    ],
    secret: getSetting("NEXTAUTH_SECRET", "change-me-in-admin"),
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
        token.email = user.email ?? token.email
        token.provider = account?.provider ?? token.provider
        token.profile = profile ?? token.profile
        const picture = (user as { image?: string }).image ?? (profile as { picture?: string; image?: string })?.picture ?? (profile as { picture?: string; image?: string })?.image
        if (picture) token.picture = picture
        try {
          const provider = account?.provider ?? "credentials"
          const ssoSubject = (profile as { sub?: string; oid?: string })?.sub ?? (profile as { sub?: string; oid?: string })?.oid ?? account?.providerAccountId ?? ""
          if (isSSO && ssoSubject) {
            const ssoName = (profile as { name?: string; displayName?: string })?.name ?? (profile as { name?: string; displayName?: string })?.displayName ?? (user as { name?: string })?.name ?? null
            await dbQuery(
              `UPDATE ai_portal.users SET sso_provider = $1, sso_subject = $2, last_login_at = now(), updated_at = now(), full_name = COALESCE(full_name, $4) WHERE id = $3::uuid`,
              [account!.provider, ssoSubject, uid, ssoName]
            )
          } else {
            await dbQuery(
              `UPDATE ai_portal.users SET last_login_at = now() WHERE id = $1::uuid`,
              [uid]
            )
          }
          await dbQuery(
            `INSERT INTO ai_portal.login_events (user_id, provider) VALUES ($1::uuid, $2)`,
            [uid, provider]
          )
        } catch (_) {}
      }
      if (token.id) {
        const email = (token.email as string) ?? (user?.email as string)
        if (isAlwaysAdmin(email)) {
          token.is_admin = true
        } else {
          try {
            const r = await dbQuery<{ role?: string; is_admin?: boolean }>(
              `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
              [token.id]
            )
            const row = r.rows[0]
            token.is_admin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
          } catch {
            token.is_admin = false
          }
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
        const email = (session.user as { email?: string }).email
        if (isAlwaysAdmin(email)) {
          ;(session.user as Record<string, unknown>).is_admin = true
        } else {
          const userId = token.id as string
          if (userId) {
            try {
              const r = await dbQuery<{ role?: string; is_admin?: boolean }>(
                `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
                [userId]
              )
              const row = r.rows[0]
              ;(session.user as Record<string, unknown>).is_admin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
            } catch {
              ;(session.user as Record<string, unknown>).is_admin = !!token.is_admin
            }
          } else {
            ;(session.user as Record<string, unknown>).is_admin = !!token.is_admin
          }
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
        return `${baseUrl}/assistants/central`
      }
    },
  },
  events: {},
  debug: false,
  }
}

let cachedNextAuthHandler: ReturnType<typeof NextAuth> | null = null
function getNextAuthHandler() {
  if (!cachedNextAuthHandler) cachedNextAuthHandler = NextAuth(getNextAuthOptions() as any)
  return cachedNextAuthHandler
}

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
  const secret = getSetting("NEXTAUTH_SECRET", "change-me-in-admin")
  if (getBootstrapEnv("NODE_ENV", "development") === "production" && (secret === "" || secret === "change-me-in-admin")) {
    console.error("[auth] NEXTAUTH_SECRET not set in production. Set it in Admin → Settings.")
    res.status(503).json({
      error: "Server configuration error",
      message: "NEXTAUTH_SECRET is not set. Set it in Admin → Settings (Cài đặt hệ thống).",
    })
    return
  }

  const pathAfterAuth = getPathAfterAuth(req.originalUrl)
  const nextauth = pathAfterAuth ? pathAfterAuth.split("/").filter(Boolean) : []
  const cookies = parseCookies(req.headers.cookie)

  // GET /api/auth/admin-check — trả về is_admin theo session (admin hoặc developer đều được)
  if (req.method === "GET" && nextauth[0] === "admin-check") {
    try {
      const token = await getToken({
        req: { cookies, headers: req.headers } as any,
        secret: getSetting("NEXTAUTH_SECRET", "change-me-in-admin"),
      })
      const userId = (token as { id?: string })?.id
      const userEmail = (token as { email?: string })?.email as string | undefined
      let is_admin = isAlwaysAdmin(userEmail)
      if (!is_admin && userId) {
        const r = await dbQuery<{ role?: string; is_admin?: boolean }>(
          `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE id = $1::uuid LIMIT 1`,
          [userId]
        )
        const row = r.rows[0]
        is_admin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
      }
      if (!is_admin && userEmail) {
        const r2 = await dbQuery<{ role?: string; is_admin?: boolean }>(
          `SELECT COALESCE(role, 'user') AS role, is_admin FROM ai_portal.users WHERE email = $1 LIMIT 1`,
          [userEmail]
        )
        const row = r2.rows[0]
        is_admin = !!row && (row.role === "admin" || row.role === "developer" || !!row.is_admin)
      }
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
  // Docker: NEXTAUTH_URL phải là URL trình duyệt mở (vd. http://localhost:3000), trùng redirect đăng ký Azure
  const baseUrl = getSetting("NEXTAUTH_URL", "http://localhost:3000")
  let originHost = baseUrl
  let originProto = "https"
  try {
    const u = new URL(baseUrl)
    originHost = u.host
    originProto = u.protocol.replace(":", "")
  } catch {
    originHost = "localhost"
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

  // Đảm bảo mọi response 5xx đều là JSON (NextAuth đôi khi trả plain text "Internal Server Error" → client báo CLIENT_FETCH_ERROR / invalid JSON)
  const wrappedRes = wrapResForJsonErrors(res)

  try {
    await getNextAuthHandler()(reqForAuth, wrappedRes)
  } catch (err: any) {
    console.error("[auth] NextAuth handler error:", err?.code ?? err?.name, err?.message ?? err)
    if (!res.headersSent) {
      res.status(500).setHeader("Content-Type", "application/json").json({
        error: "Internal Server Error",
        ...(getSetting("DEBUG") === "true" && { detail: err?.message }),
      })
    }
  }
}

function sendJsonError(res: ExpressResponse, status: number, message: string, detail?: string) {
  if (res.headersSent) return
  res.status(status).setHeader("Content-Type", "application/json").json(
    detail ? { error: message, detail } : { error: message }
  )
}

/** Wrap res để nếu status 5xx mà body không phải JSON thì ghi lại thành JSON (tránh NextAuth trả plain text → client CLIENT_FETCH_ERROR). */
function wrapResForJsonErrors(res: ExpressResponse): ExpressResponse {
  const originalEnd = res.end.bind(res)
  ;(res as any).end = function (chunk?: any, encoding?: any, cb?: any) {
    const code = (res as any).statusCode ?? 200
    if (code >= 500 && chunk != null) {
      const raw = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk ?? "")
      const body = raw.trim()
      if (body && !body.startsWith("{") && !body.startsWith("[")) {
        res.setHeader("Content-Type", "application/json")
        const json = JSON.stringify({ error: body || "Internal Server Error" })
        return originalEnd.call(res, json, "utf8", typeof encoding === "function" ? encoding : cb)
      }
    }
    return originalEnd.call(res, chunk, encoding, cb)
  }
  return res
}

router.all("*", (req: ExpressRequest, res: ExpressResponse) => {
  handleNextAuth(req, res).catch((err: any) => {
    console.error("[auth] Unhandled rejection:", err?.message ?? err)
    sendJsonError(res, 500, "Internal Server Error", getSetting("DEBUG") === "true" ? err?.message : undefined)
  })
})

export default router
