// server.ts
// IMPORTANT: Load environment variables FIRST before any other imports
import "./lib/env"

import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
import path from "path"
import fs from "fs"
import { CORS_ORIGIN } from "./lib/config"

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}))
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Health check
app.get("/health", async (req: Request, res: Response) => {
  try {
    // Kiểm tra database connection
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
      error: process.env.NODE_ENV === "development" ? err.message : undefined
    })
  }
})

// Helper: kiểm tra request có mã quản trị hợp lệ (cookie hoặc header)
function hasValidAdminSecret(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return true // Không cấu hình thì không bắt buộc (dev)
  const cookieMatch = req.headers.cookie?.match(/admin_secret=([^;]+)/)
  const fromCookie = cookieMatch ? decodeURIComponent(cookieMatch[1].trim()) : null
  const fromHeader = req.headers["x-admin-secret"] as string | undefined
  return fromCookie === secret || fromHeader === secret
}

// Trang đăng nhập quản trị (form nhập mã)
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

// Root route - Admin Dashboard (chỉ trong development hoặc khi ENABLE_ADMIN_ROUTES=true)
app.get("/", async (req: Request, res: Response) => {
  const isDevelopment = process.env.NODE_ENV === "development"
  const adminEnabled = process.env.ENABLE_ADMIN_ROUTES === "true"
  const allowAdmin = isDevelopment || adminEnabled
  
  if (!allowAdmin) {
    return res.json({
      message: "Backend API Server",
      version: "1.0.0",
      endpoints: {
        health: "/health",
        chat: "/api/chat",
        orchestrator: "/api/orchestrator",
        agents: "/api/agents",
        researchAssistants: "/api/research-assistants",
        storage: "/api/storage"
      },
      note: "Admin dashboard chỉ khả dụng trong development mode hoặc khi ENABLE_ADMIN_ROUTES=true"
    })
  }

  // Nếu có ADMIN_SECRET thì chỉ cho vào khi có mã hợp lệ
  if (process.env.ADMIN_SECRET && !hasValidAdminSecret(req)) {
    return res.type("html").send(adminLoginHtml)
  }
  
  // Serve dashboard HTML - tìm file từ nhiều vị trí có thể
  const possiblePaths = [
    path.join(__dirname, "routes/dashboard.html"),
    path.join(process.cwd(), "src/routes/dashboard.html"),
    path.join(process.cwd(), "backend/src/routes/dashboard.html"),
  ]
  
  let dashboardPath: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      dashboardPath = p
      break
    }
  }
  
  if (dashboardPath) {
    return res.sendFile(dashboardPath)
  }
  
  // Fallback: redirect đến admin view cũ nếu không tìm thấy dashboard
  res.redirect("/api/admin/view")
})

// Routes
import chatRouter from "./routes/chat"
import orchestratorRouter from "./routes/orchestrator"
import agentsRouter from "./routes/agents"
import uploadRouter from "./routes/upload"
import demoAgentRouter from "./routes/demo-agent"
import mainAgentRouter from "./routes/main-agent"
import writeAgentRouter from "./routes/write-agent"
import dataAgentRouter from "./routes/data-agent"
import usersRouter from "./routes/users"
import adminRouter from "./routes/admin"
import researchAssistantsRouter from "./routes/research-assistants"
import storageRouter from "./routes/storage"
import authRouter from "./routes/auth"

app.use("/api/auth", authRouter)
app.use("/api/chat", chatRouter)
app.use("/api/orchestrator", orchestratorRouter)
app.use("/api/agents", agentsRouter)
app.use("/api/upload", uploadRouter)
app.use("/api/demo_agent", demoAgentRouter)
app.use("/api/main_agent", mainAgentRouter)
app.use("/api/write_agent", writeAgentRouter)
app.use("/api/data_agent", dataAgentRouter)
app.use("/api/users", usersRouter)
app.use("/api/admin", adminRouter)
app.use("/api/research-assistants", researchAssistantsRouter)
app.use("/api/storage", storageRouter)

// Chạy migration khi khởi động: thêm cột is_admin nếu chưa có
async function runMigrations() {
  try {
    const { query } = await import("./lib/db")
    await query(`
      ALTER TABLE research_chat.users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    `)
    console.log("✅ Migration: cột is_admin đã sẵn sàng")
  } catch (e: any) {
    console.warn("⚠️ Migration is_admin:", e?.message || e)
  }
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err)
  res.status(500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  })
})

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" })
})

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`)
    const corsOriginsDisplay = Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(", ") : CORS_ORIGIN
    console.log(`📡 CORS enabled for: ${corsOriginsDisplay}`)
  })
})

export default app
