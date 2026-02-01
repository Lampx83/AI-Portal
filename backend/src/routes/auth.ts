/**
 * NextAuth API route - chạy trên backend để Nginx/proxy route /api/auth/* đúng.
 * Dùng NextAuthApiHandler (Pages Router style): nhận (req, res) giống Express, không dùng next/headers.
 */
import { Router, Request as ExpressRequest, Response as ExpressResponse } from "express"
import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { query } from "../lib/db"

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
    const found = await query(
      `SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`,
      [email]
    )
    if (found.rowCount && found.rows[0]?.id) return found.rows[0].id as string

    const newId = crypto.randomUUID()
    await query(
      `INSERT INTO research_chat.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [newId, email, email.split("@")[0]]
    )
    const finalCheck = await query(
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
        if (credentials?.email === "user@example.com" && credentials?.password === "password123") {
          const uid = await ensureUserUuidByEmail(credentials.email)
          return { id: uid ?? "00000000-0000-0000-0000-000000000000", name: "Test User", email: credentials.email }
        }
        return null
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, account, profile }: {
      token: Record<string, unknown>; user?: { email?: string | null }; account?: { provider?: string; access_token?: string }; profile?: unknown;
    }) {
      if (user) {
        const uid = await ensureUserUuidByEmail(user.email)
        token.id = uid ?? "00000000-0000-0000-0000-000000000000"
        token.provider = account?.provider ?? token.provider
        token.profile = profile ?? token.profile
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
 * Gọi NextAuthApiHandler (Pages Router): req.query có nextauth từ path, req.cookies từ Cookie header.
 * Không dùng NextAuthRouteHandler để tránh next/headers (chỉ chạy trong Next.js).
 */
async function handleNextAuth(req: ExpressRequest, res: ExpressResponse): Promise<void> {
  const pathAfterAuth = (req.originalUrl.match(/^\/api\/auth\/?(.*?)(?:\?|$)/)?.[1] ?? "").trim()
  const nextauth = pathAfterAuth ? pathAfterAuth.split("/").filter(Boolean) : []

  const query = { ...(req.query as Record<string, string | string[] | undefined>), nextauth }
  const cookies = parseCookies(req.headers.cookie)

  const reqForAuth = {
    ...req,
    query,
    cookies,
  }

  try {
    await nextAuthHandler(reqForAuth, res)
  } catch (err: any) {
    console.error("NextAuth handler error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
}

router.all("*", (req: ExpressRequest, res: ExpressResponse) => handleNextAuth(req, res))

export default router
