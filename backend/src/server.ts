// server.ts – Config from Settings (load from DB before creating app). Only process.env: NODE_ENV, PORT, POSTGRES_*
import "./lib/env"

import fs from "fs"
import path from "path"
import http from "http"
import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import { getSetting, getBootstrapEnv } from "./lib/settings"
import { getCorsOrigin } from "./lib/settings"

const PORT = Number(getBootstrapEnv("PORT", "3001"))
const app = express()

// When behind reverse proxy (nginx, etc.), use X-Forwarded-Proto/Host to build correct URL
app.set("trust proxy", 1)

// Middleware (CORS from Settings – read on each request to apply config after DB load)
app.use(cors({
  origin: (origin, cb) => {
    const allowed = getCorsOrigin()
    if (!origin) return cb(null, true)
    if (Array.isArray(allowed)) return cb(null, allowed.includes(origin))
    return cb(null, allowed === origin)
  },
  credentials: true,
}))
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Health check
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Check database connection
    const { query } = await import("./lib/db")
    await query("SELECT 1")
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      database: "connected"
    })
  } catch (err: any) {
    console.error("❌ Health check failed:", err)
    res.status(503).json({ 
      status: "error",
      timestamp: new Date().toISOString(),
      database: "disconnected",
      error: getSetting("DEBUG") === "true" ? err.message : undefined
    })
  }
})

// Helper: check if request has valid admin code (cookie or header). Code configured in Admin → Settings.
function hasValidAdminSecret(req: Request): boolean {
  const secret = getSetting("ADMIN_SECRET")
  if (!secret) return true
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  return fromCookie === secret || fromHeader === secret
}

// Admin login page (form to enter code)
const adminLoginHtml = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Đăng nhập quản trị</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #e9ecef; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .box { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 360px; width: 100%; }
  h1 { font-size: 20px; color: #212529; margin-bottom: 20px; }
  input { width: 100%; padding: 12px 16px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 14px; margin-bottom: 16px; }
  button { width: 100%; padding: 12px; background: #495057; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
  button:hover { background: #343a40; }
  .error { color: #dc3545; font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
  <div class="box">
    <h1>Mã truy cập quản trị</h1>
    <form method="POST" action="/api/admin/auth">
      <input type="password" name="secret" placeholder="Nhập mã truy cập" required autofocus>
      <button type="submit">Đăng nhập</button>
    </form>
    <p id="err" class="error"></p>
  </div>
  <script>
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'invalid') document.getElementById('err').textContent = 'Mã không đúng.';
  </script>
</body>
</html>`

// GET /login - Redirect to frontend login page
app.get("/login", (req: Request, res: Response) => {
  const base = (getSetting("NEXTAUTH_URL", "http://localhost:3000") || "http://localhost:3000").replace(/\/$/, "")
  const callbackUrl = typeof req.query.callbackUrl === "string" ? req.query.callbackUrl : undefined
  const next = typeof req.query.next === "string" ? req.query.next : undefined
  const params = new URLSearchParams()
  if (callbackUrl) params.set("callbackUrl", callbackUrl)
  if (next) params.set("next", next)
  const qs = params.toString()
  return res.redirect(302, `${base}/login${qs ? `?${qs}` : ""}`)
})

// Root route - Backend is API only. No redirect to frontend; always return API info or login form if needed.
app.get("/", async (req: Request, res: Response) => {
  const apiInfo = {
    message: "Backend API Server",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      chat: "/api/chat",
      orchestrator: "/api/orchestrator",
      agents: "/api/agents",
      assistants: "/api/assistants",
      storage: "/api/storage",
    },
    note: "Trang quản trị tại frontend: NEXTAUTH_URL/admin",
  }

  // If ADMIN_SECRET is set and no code yet: show code entry form
  if (getSetting("ADMIN_SECRET") && !hasValidAdminSecret(req)) {
    return res.type("html").send(adminLoginHtml)
  }

  // No redirect; always return API info for direct backend access
  return res.json(apiInfo)
})

// Routes
import chatRouter from "./routes/chat"
import orchestratorRouter from "./routes/orchestrator"
import agentsRouter from "./routes/agents"
import uploadRouter from "./routes/upload"
import centralAgentRouter from "./routes/central-agent"
import usersRouter from "./routes/users"
import adminRouter from "./routes/admin"
import assistantsRouter from "./routes/assistants"
import toolsRouter from "./routes/tools"
import storageRouter from "./routes/storage"
import authRouter from "./routes/auth"
import projectsRouter from "./routes/projects"
import feedbackRouter from "./routes/feedback"
import siteStringsRouter from "./routes/site-strings"
import setupRouter from "./routes/setup"
import shortcutsRouter from "./routes/shortcuts"
import appsProxyRouter from "./routes/apps-proxy"
import annotaRouter from "./routes/annota"
import quantisRouter from "./routes/quantis"
import { mountAllBundledApps, mountedAppsDispatcher, createEmbedStaticRouter } from "./lib/mounted-apps"

// Load agents from src/agents (each dir has manifest.json + index.ts)
const agentsDir = path.join(__dirname, "agents")
const mountedAgentPaths = new Set<string>()
if (fs.existsSync(agentsDir)) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const req = require
  for (const name of fs.readdirSync(agentsDir)) {
    const dir = path.join(agentsDir, name)
    if (!fs.statSync(dir).isDirectory()) continue
    const manifestPath = path.join(dir, "manifest.json")
    if (!fs.existsSync(manifestPath)) continue
    let manifest: { mountPath?: string }
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    } catch {
      continue
    }
    const mountPath = manifest.mountPath
    if (!mountPath || typeof mountPath !== "string") continue
    const entryPath = path.join(dir, "index.js")
    const entryPathTs = path.join(dir, "index.ts")
    const resolved = fs.existsSync(entryPath) ? entryPath : fs.existsSync(entryPathTs) ? entryPathTs : null
    if (!resolved) continue
    try {
      const mod = req(resolved)
      const router = mod?.default
      if (router) {
        app.use(mountPath, router)
        mountedAgentPaths.add(mountPath)
        console.log("[agents] mounted", name, "at", mountPath)
      }
    } catch (e: any) {
      console.warn("[agents] failed to load", name, e?.message || e)
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./lib/app-ref").setApp(app, mountedAgentPaths)

app.use("/api/auth", authRouter)
app.use("/api/chat", chatRouter)
app.use("/api/orchestrator", orchestratorRouter)
app.use("/api/agents", agentsRouter)
app.use("/api/upload", uploadRouter)
app.use("/api/central_agent", centralAgentRouter)
app.use("/api/users", usersRouter)
app.use("/api/admin", adminRouter)
app.use("/api/assistants", assistantsRouter)
app.use("/api/tools", toolsRouter)
app.use("/api/storage", storageRouter)
app.use("/api/projects", projectsRouter)
app.use("/api/feedback", feedbackRouter)
app.use("/api/site-strings", siteStringsRouter)
app.use("/api/setup", setupRouter)
app.use("/api/shortcuts", shortcutsRouter)
app.use("/api/annota", annotaRouter)
app.use("/api/quantis", quantisRouter)
app.use("/embed", createEmbedStaticRouter())

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err)
  res.status(500).json({
    error: "Internal Server Error",
    message: getSetting("DEBUG") === "true" ? err.message : undefined
  })
})

// Startup: load config, mount /api/apps, then add 404. Avoid 404 blocking /api/apps when mount runs in callback.
const server = http.createServer(app)
async function startServer() {
  const { loadRuntimeConfigFromDb } = await import("./lib/runtime-config")
  await loadRuntimeConfigFromDb().catch((e) => console.warn("[runtime-config] load failed:", e?.message))
  await mountAllBundledApps(app).catch((e) => console.warn("[mounted-apps] mount failed:", e?.message))
  app.use("/api/apps", mountedAppsDispatcher(), appsProxyRouter)
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" })
  })
  server.listen(PORT, () => {
    console.log(`[server] Backend listening on port ${PORT}`)
  })
}
startServer()

export default app
