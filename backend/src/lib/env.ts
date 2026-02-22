// Load root .env (AI-Portal/.env) when running npm run dev from backend/ — Docker/shell still override.
// This module is imported first so other code can rely on process.env.
import path from "path"
try {
  const dotenv = require("dotenv") as { config: (opts: { path: string }) => { parsed?: unknown } }
  const cwd = process.cwd()
  const rootEnv = path.join(cwd, "..", ".env")   // when running from backend/
  const hereEnv = path.join(cwd, ".env")          // when running from repo root
  const fs = require("fs") as { existsSync: (p: string) => boolean }
  const envPath = fs.existsSync(rootEnv) ? rootEnv : fs.existsSync(hereEnv) ? hereEnv : rootEnv
  dotenv.config({ path: envPath })
} catch {
  // dotenv optional; process.env from Docker/shell is still used
}
export {}
