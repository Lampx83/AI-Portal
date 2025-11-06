import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { query } from "@/lib/db"


async function ensureUserUuidByEmail(email?: string | null): Promise<string | null> {
    
    console.log("🔍 DB ENV CHECK:", {
  POSTGRES_HOST: process.env.POSTGRES_HOST,
  POSTGRES_PORT: process.env.POSTGRES_PORT,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_SSL: process.env.POSTGRES_SSL,
})
    
    console.log("🔍 ensureUserUuidByEmail called with:", email)
    if (!email) return null

    console.log("🔍 Running SELECT...")
    const found = await query(`SELECT id FROM research_chat.users WHERE email = $1 LIMIT 1`, [email])
    console.log("✅ SELECT done")

    if (found.rowCount && found.rows[0]?.id) return found.rows[0].id

    console.log("🔍 Running INSERT...")
    const newId = crypto.randomUUID()
    await query(
        `INSERT INTO research_chat.users (id, email, display_name) VALUES ($1::uuid, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [newId, email, email.split("@")[0]]
    )
    console.log("✅ INSERT done")

    return newId
}

const handler = NextAuth({
    providers: [
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID!,
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text", placeholder: "jsmith@example.com" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                // Add your own logic here to retrieve a user from a database
                // For demonstration, we'll use a simple hardcoded user
                if (credentials?.email === "user@example.com" && credentials?.password === "password123") {
                    // Any object returned will be saved in `user` property of the JWT
                    // lấy/ tạo uuid theo email
                    const uid = await ensureUserUuidByEmail(credentials.email)
                    return { id: uid ?? "00000000-0000-0000-0000-000000000000", name: "Test User", email: credentials.email }
                } else {
                    // If you return null then an error will be displayed advising the user they are unable to sign in.
                    return null
                    // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
                }
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    pages: {
        signIn: "/login", // Redirect to your custom login page
    },
    callbacks: {
        async jwt({ token, user, account, profile }) {
            if (user) {
                // Nếu là CredentialsProvider → user.id đã có sẵn
                // Nếu là AzureAD → cần tạo/ lấy uuid
                const uid = await ensureUserUuidByEmail(user.email)
                token.id = uid ?? "00000000-0000-0000-0000-000000000000"
             
                token.provider = account?.provider ?? token.provider
                token.profile = profile ?? token.profile
            }

            if (account?.access_token) token.accessToken = account.access_token
            return token
        },
        async session({ session, token }) {
            // Send properties to the client, such as an access_token from a provider.
            session.accessToken = token.accessToken as string
            session.user.id = token.id as string
            session.user.profile = token.profile // Add profile to session
            session.user.provider = token.provider as string // Add provider to session
            session.user.image = token.picture || session.user.image || null
            return session
        },
        async redirect({ url, baseUrl }) {
            try {
                // Ưu tiên path nội bộ
                if (url.startsWith("/")) return `${baseUrl}${url}`
                const u = new URL(url)
                // Cùng origin -> cho phép
                if (u.origin === baseUrl) return url
            } catch { /* ignore parse error */ }
            // Fallback an toàn
            return `${baseUrl}/assistants/main`
        },
    },
})

export { handler as GET, handler as POST }
