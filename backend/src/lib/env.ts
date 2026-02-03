// lib/env.ts
// Load environment variables before any other imports
import dotenv from "dotenv"
import path from "path"
import fs from "fs"

const rootEnvPath = path.resolve(process.cwd(), "../.env")
const currentEnvPath = path.resolve(process.cwd(), ".env")

// Try root .env first (for development when running from backend/)
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath })
} else if (fs.existsSync(currentEnvPath)) {
  dotenv.config({ path: currentEnvPath })
} else {
  dotenv.config()
  if (process.env.NODE_ENV !== "production") {
    console.warn("No .env file found, using environment variables only")
  }
}

// Export to ensure this module is executed
export {}
