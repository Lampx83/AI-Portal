// lib/config.ts
// Ensure env is loaded
import "./env"

export const API_CONFIG = {
    baseUrl: process.env.API_BASE_URL || "http://localhost:3001",
}

export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000"
