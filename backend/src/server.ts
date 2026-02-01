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

// Chạy migration khi khởi động
async function runMigrations() {
  try {
    const { query } = await import("./lib/db")
    
    // Migration 001: thêm cột is_admin
    await query(`
      ALTER TABLE research_chat.users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    `)
    console.log("✅ Migration: cột is_admin đã sẵn sàng")
    
    // Migration 002: tạo bảng research_assistants
    const migrationPath = path.join(__dirname, "../migrations/002_create_research_assistants.sql")
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, "utf-8")
      await query(migrationSql)
      console.log("✅ Migration: bảng research_assistants đã sẵn sàng")
      
      // Seed dữ liệu agents từ env vars
      await seedResearchAssistants()
    }

    // Migration 003: bảng agent test results
    const migration003 = path.join(__dirname, "../migrations/003_create_agent_test_results.sql")
    if (fs.existsSync(migration003)) {
      const sql = fs.readFileSync(migration003, "utf-8")
      await query(sql)
      console.log("✅ Migration: bảng agent_test_runs, agent_test_results đã sẵn sàng")
    }

    // Migration 004: đổi alias documents -> papers
    const migration004 = path.join(__dirname, "../migrations/004_rename_documents_to_papers.sql")
    if (fs.existsSync(migration004)) {
      const sql = fs.readFileSync(migration004, "utf-8")
      await query(sql)
      console.log("✅ Migration: documents -> papers đã áp dụng")
    }

    // Migration 005: cột thời gian phản hồi cho agent test
    const migration005 = path.join(__dirname, "../migrations/005_add_agent_test_timings.sql")
    if (fs.existsSync(migration005)) {
      const sql = fs.readFileSync(migration005, "utf-8")
      await query(sql)
      console.log("✅ Migration: agent test timings đã sẵn sàng")
    }

    // Migration 006: chi tiết test (data_details, ask_text_details, ask_file_details)
    const migration006 = path.join(__dirname, "../migrations/006_agent_test_details_json.sql")
    if (fs.existsSync(migration006)) {
      const sql = fs.readFileSync(migration006, "utf-8")
      await query(sql)
      console.log("✅ Migration: agent test details JSON đã sẵn sàng")
    }

    // Migration 007: users password, sso, last_login_at
    const migration007 = path.join(__dirname, "../migrations/007_users_password_sso_lastlogin.sql")
    if (fs.existsSync(migration007)) {
      const sql = fs.readFileSync(migration007, "utf-8")
      await query(sql)
      console.log("✅ Migration: users password/sso/last_login đã sẵn sàng")
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    console.warn("⚠️ Migration error:", msg)
    if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
      console.warn("💡 PostgreSQL chưa chạy. Khởi động: ./scripts/start-db.sh hoặc docker compose up -d postgres")
    }
  }
}

// Seed dữ liệu agents từ env vars và config mặc định
async function seedResearchAssistants() {
  try {
    const { query } = await import("./lib/db")
    
    const defaultAgents = [
      {
        alias: "main",
        icon: "Users",
        baseUrl: "http://localhost:3001/api/main_agent/v1",
        domainUrl: null,
        displayOrder: 1,
        config: { isInternal: true },
      },
      {
        alias: "papers",
        icon: "FileText",
        baseUrl: process.env.PAPER_AGENT_URL || "http://localhost:8000/v1",
        domainUrl: "https://research.neu.edu.vn/api/agents/papers",
        displayOrder: 2,
        config: {},
      },
      {
        alias: "experts",
        icon: "Users",
        baseUrl: process.env.EXPERT_AGENT_URL || "http://localhost:8011/v1",
        domainUrl: "https://research.neu.edu.vn/api/agents/experts",
        displayOrder: 3,
        config: {},
      },
      {
        alias: "write",
        icon: "FileText",
        baseUrl: "http://localhost:3001/api/write_agent/v1",
        domainUrl: null,
        displayOrder: 4,
        config: { isInternal: true },
      },
      {
        alias: "data",
        icon: "Database",
        baseUrl: "http://localhost:3001/api/data_agent/v1",
        domainUrl: null,
        displayOrder: 5,
        config: { isInternal: true },
      },
      {
        alias: "review",
        icon: "ListTodo",
        baseUrl: process.env.REVIEW_AGENT_URL || "http://localhost:8007/v1",
        domainUrl: "https://research.neu.edu.vn/api/agents/review",
        displayOrder: 6,
        config: {},
      },
      {
        alias: "publish",
        icon: "Newspaper",
        baseUrl: "https://publication.neuresearch.workers.dev/v1",
        domainUrl: null,
        displayOrder: 7,
        config: {},
      },
      {
        alias: "funds",
        icon: "Award",
        baseUrl: "https://fund.neuresearch.workers.dev/v1",
        domainUrl: null,
        displayOrder: 8,
        config: {},
      },
      {
        alias: "plagiarism",
        icon: "ShieldCheck",
        baseUrl: process.env.PLAGIARISM_AGENT_URL || "http://10.2.13.53:8002/api/file-search/ai",
        domainUrl: "https://research.neu.edu.vn/api/agents/review",
        displayOrder: 9,
        config: {},
      },
    ]
    
    for (const agent of defaultAgents) {
      await query(
        `INSERT INTO research_chat.research_assistants (alias, icon, base_url, domain_url, display_order, config_json)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (alias) DO NOTHING`,
        [agent.alias, agent.icon, agent.baseUrl, agent.domainUrl, agent.displayOrder, JSON.stringify(agent.config)]
      )
    }
    console.log("✅ Seed: research_assistants đã được khởi tạo")
  } catch (e: any) {
    console.warn("⚠️ Seed research_assistants error:", e?.message || e)
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

// Luôn start server; migration thất bại (DB chưa chạy) không chặn listen
runMigrations()
  .catch(() => {})
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://localhost:${PORT}`)
      const corsOriginsDisplay = Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(", ") : CORS_ORIGIN
      console.log(`📡 CORS enabled for: ${corsOriginsDisplay}`)
    })
  })

export default app
