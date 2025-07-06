import NextAuth from "next-auth"
import AzureADProvider from "next-auth/providers/azure-ad"
import CredentialsProvider from "next-auth/providers/credentials"

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
                    return { id: "1", name: "Test User", email: "user@example.com" }
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
        async jwt({ token, account, profile }) {
            // Persist the OAuth access_token and other profile information to the JWT
            if (account) {
                token.accessToken = account.access_token
                token.id = account.id_token
                token.provider = account.provider // Store the provider
            }
            if (profile) {
                token.profile = profile
            }
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
    },
})

export { handler as GET, handler as POST }
