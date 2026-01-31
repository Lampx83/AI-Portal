// lib/config.ts
export const API_CONFIG = {
    baseUrl:
        typeof window !== 'undefined' 
            ? (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001")  // Client-side: use backend URL
            : (process.env.NEXT_PUBLIC_API_BASE_URL || 
               process.env.BACKEND_URL || 
               "http://localhost:3001"), // Server-side: use backend URL
}
