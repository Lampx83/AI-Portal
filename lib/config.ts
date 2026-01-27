// lib/config.ts
export const API_CONFIG = {
    baseUrl:
        typeof window !== 'undefined' 
            ? window.location.origin  // Client-side: use current origin
            : process.env.NEXT_PUBLIC_API_BASE_URL || 
              process.env.NEXTAUTH_URL || 
              "http://localhost:3000", // Server-side fallback
}
