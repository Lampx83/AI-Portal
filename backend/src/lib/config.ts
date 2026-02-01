// lib/config.ts
// Ensure env is loaded
import "./env"

export const API_CONFIG = {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3001",
}

// Parse CORS_ORIGIN từ comma-separated string thành array hoặc string
const corsOriginEnv = process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3002"
export const CORS_ORIGIN: string | string[] = 
    corsOriginEnv.includes(",")
        ? corsOriginEnv.split(",").map(origin => origin.trim())
        : corsOriginEnv
