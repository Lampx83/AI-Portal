// Load .env from parent directory before NextAuth initializes
// This ensures Azure AD env vars are available
import { readFileSync } from 'fs'
import { resolve } from 'path'

try {
  const envPath = resolve(process.cwd(), '../.env')
  const envFile = readFileSync(envPath, 'utf-8')
  const envLines = envFile.split('\n')
  
  envLines.forEach(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine || trimmedLine.startsWith('#')) return
    
    const equalIndex = trimmedLine.indexOf('=')
    if (equalIndex === -1) return
    
    const key = trimmedLine.substring(0, equalIndex).trim()
    const value = trimmedLine.substring(equalIndex + 1).trim()
    const cleanValue = value.replace(/^["']|["']$/g, '')
    
    if (!process.env[key]) {
      process.env[key] = cleanValue
    }
  })
} catch (error: any) {
  // Silently fail - env vars might already be loaded from next.config.mjs
}

import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"
import { API_CONFIG } from "@/lib/config"

/**
 * Ensure user exists in database by calling backend API
 * Frontend no longer connects directly to database
 */
async function ensureUserUuidByEmail(email?: string | null): Promise<string | null> {
    if (!email) return null

    try {
        const response = await fetch(`${API_CONFIG.baseUrl}/api/users/ensure`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email }),
        })

        if (!response.ok) {
            console.error(`❌ Failed to ensure user: HTTP ${response.status}`)
            return null
        }

        const data = await response.json()
        return data.id || null
    } catch (error: any) {
        console.error("❌ Error ensuring user:", error)
        return null
    }
}

// Helper để validate GUID format
function isValidGuid(value: string | undefined): boolean {
    if (!value) return false
    const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return guidRegex.test(value)
}

// Chỉ enable Azure AD provider nếu có đủ config và đúng format
const azureAdConfig = {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    tenantId: process.env.AZURE_AD_TENANT_ID,
}

const providers: any[] = []

// Chỉ thêm Azure AD provider nếu có đủ config và đúng format
console.log("🔍 Azure AD Config Check:", {
    hasClientId: !!azureAdConfig.clientId,
    hasClientSecret: !!azureAdConfig.clientSecret,
    hasTenantId: !!azureAdConfig.tenantId,
    clientIdValid: azureAdConfig.clientId ? isValidGuid(azureAdConfig.clientId) : false,
    tenantIdValid: azureAdConfig.tenantId ? isValidGuid(azureAdConfig.tenantId) : false,
    clientIdPreview: azureAdConfig.clientId ? `${azureAdConfig.clientId.substring(0, 8)}...` : "missing",
    tenantIdPreview: azureAdConfig.tenantId ? `${azureAdConfig.tenantId.substring(0, 8)}...` : "missing",
})

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
    console.log("✅ Azure AD provider enabled")
} else {
    console.warn("⚠️  Azure AD provider disabled - missing or invalid configuration")
    if (!azureAdConfig.clientId) {
        console.warn("   ❌ Missing AZURE_AD_CLIENT_ID")
    } else if (!isValidGuid(azureAdConfig.clientId)) {
        console.warn(`   ❌ Invalid AZURE_AD_CLIENT_ID format: ${azureAdConfig.clientId}`)
        console.warn(`      Expected GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
    }
    if (!azureAdConfig.clientSecret) {
        console.warn("   ❌ Missing AZURE_AD_CLIENT_SECRET")
    }
    if (!azureAdConfig.tenantId) {
        console.warn("   ❌ Missing AZURE_AD_TENANT_ID")
    } else if (!isValidGuid(azureAdConfig.tenantId)) {
        console.warn(`   ❌ Invalid AZURE_AD_TENANT_ID format: ${azureAdConfig.tenantId}`)
        console.warn(`      Expected GUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
    }
}

const handler = NextAuth({
    // Trust host để NextAuth tự detect origin từ request headers
    // Điều này giúp xử lý đúng khi chạy qua proxy hoặc load balancer
    trustHost: true,
    providers: [
        ...providers,
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
            // Ưu tiên sử dụng baseUrl từ NextAuth (được detect từ request headers)
            // Nếu không có, fallback về NEXTAUTH_URL env variable
            
            // Nếu url là relative path (bắt đầu bằng /)
            if (url.startsWith("/")) {
                // Sử dụng baseUrl từ NextAuth (đã được detect từ request)
                // baseUrl sẽ là origin của request hiện tại (localhost:3000 hoặc research.neu.edu.vn)
                return `${baseUrl}${url}`
            }
            
            // Nếu url là absolute URL
            try {
                const urlObj = new URL(url)
                const baseUrlObj = new URL(baseUrl)
                
                // Nếu cùng origin với baseUrl -> cho phép
                if (urlObj.origin === baseUrlObj.origin) {
                    return url
                }
                
                // Nếu khác origin -> redirect về baseUrl với path từ url
                return `${baseUrl}${urlObj.pathname}${urlObj.search}`
            } catch (error) {
                // Nếu có lỗi parse URL, fallback về trang chủ của baseUrl
                return `${baseUrl}/assistants/main`
            }
        },
    },
})

export { handler as GET, handler as POST }
