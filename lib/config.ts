// lib/config.ts
export const API_CONFIG = {
    baseUrl:
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "https://research.neu.edu.vn", // fallback local
}
