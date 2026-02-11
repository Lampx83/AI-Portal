// server.ts
// IMPORTANT: Load environment variables FIRST before any other imports
import "./lib/env"

import http from "http"
import express, { Request, Response, NextFunction } from "express"
import { attachCollabWs } from "./lib/collab-ws"
import cors from "cors"
import path from "path"
import fs from "fs"
import { CORS_ORIGIN } from "./lib/config"

const app = express()
const PORT = process.env.PORT || 3001

// Khi chạy sau reverse proxy (nginx, etc.), dùng X-Forwarded-Proto/Host để build URL đúng
app.set("trust proxy", 1)

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

// GET /login - Redirect sang trang đăng nhập frontend (tránh trùng với frontend /login)
app.get("/login", (req: Request, res: Response) => {
  const base = (process.env.NEXTAUTH_URL || "https://research.neu.edu.vn").replace(/\/$/, "")
  const callbackUrl = typeof req.query.callbackUrl === "string" ? req.query.callbackUrl : undefined
  const next = typeof req.query.next === "string" ? req.query.next : undefined
  const params = new URLSearchParams()
  if (callbackUrl) params.set("callbackUrl", callbackUrl)
  if (next) params.set("next", next)
  const qs = params.toString()
  return res.redirect(302, `${base}/login${qs ? `?${qs}` : ""}`)
})

// Root route - Backend chỉ API. Redirect sang frontend admin.
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
        storage: "/api/storage",
      },
      note: "Trang quản trị tại frontend: NEXTAUTH_URL/admin",
    })
  }

  // Nếu có ADMIN_SECRET và chưa có mã: hiện form nhập mã
  if (process.env.ADMIN_SECRET && !hasValidAdminSecret(req)) {
    return res.type("html").send(adminLoginHtml)
  }

  // Redirect sang frontend admin (giao diện React)
  const base = process.env.NEXTAUTH_URL || "https://research.neu.edu.vn"
  const adminBase = base.replace(/\/$/, "")
  return res.redirect(302, `${adminBase}/admin`)
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
import regulationsAgentRouter from "./routes/regulations-agent"
import usersRouter from "./routes/users"
import adminRouter from "./routes/admin"
import researchAssistantsRouter from "./routes/research-assistants"
import storageRouter from "./routes/storage"
import authRouter from "./routes/auth"
import writeArticlesRouter from "./routes/write-articles"
import projectsRouter from "./routes/projects"
import feedbackRouter from "./routes/feedback"

app.use("/api/auth", authRouter)
app.use("/api/chat", chatRouter)
app.use("/api/orchestrator", orchestratorRouter)
app.use("/api/agents", agentsRouter)
app.use("/api/upload", uploadRouter)
app.use("/api/demo_agent", demoAgentRouter)
app.use("/api/main_agent", mainAgentRouter)
app.use("/api/write_agent", writeAgentRouter)
app.use("/api/data_agent", dataAgentRouter)
app.use("/api/regulations_agent", regulationsAgentRouter)
app.use("/api/users", usersRouter)
app.use("/api/admin", adminRouter)
app.use("/api/research-assistants", researchAssistantsRouter)
app.use("/api/storage", storageRouter)
app.use("/api/write-articles", writeArticlesRouter)
app.use("/api/projects", projectsRouter)
app.use("/api/feedback", feedbackRouter)

// Chạy migration khi khởi động
async function runMigrations() {
  try {
    const { query } = await import("./lib/db")
    
    // Migration 001: thêm cột is_admin
    await query(`
      ALTER TABLE research_chat.users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
    `)

    // Migration 002: tạo bảng research_assistants
    const migrationPath = path.join(__dirname, "../migrations/002_create_research_assistants.sql")
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, "utf-8")
      await query(migrationSql)

      // Seed dữ liệu agents từ env vars
      await seedResearchAssistants()
    }

    // Migration 003: bảng agent test results
    const migration003 = path.join(__dirname, "../migrations/003_create_agent_test_results.sql")
    if (fs.existsSync(migration003)) {
      const sql = fs.readFileSync(migration003, "utf-8")
      await query(sql)
    }

    // Migration 004: đổi alias documents -> papers
    const migration004 = path.join(__dirname, "../migrations/004_rename_documents_to_papers.sql")
    if (fs.existsSync(migration004)) {
      const sql = fs.readFileSync(migration004, "utf-8")
      await query(sql)
    }

    // Migration 005: cột thời gian phản hồi cho agent test
    const migration005 = path.join(__dirname, "../migrations/005_add_agent_test_timings.sql")
    if (fs.existsSync(migration005)) {
      const sql = fs.readFileSync(migration005, "utf-8")
      await query(sql)
    }

    // Migration 006: chi tiết test (data_details, ask_text_details, ask_file_details)
    const migration006 = path.join(__dirname, "../migrations/006_agent_test_details_json.sql")
    if (fs.existsSync(migration006)) {
      const sql = fs.readFileSync(migration006, "utf-8")
      await query(sql)
    }

    // Migration 007: users password, sso, last_login_at
    const migration007 = path.join(__dirname, "../migrations/007_users_password_sso_lastlogin.sql")
    if (fs.existsSync(migration007)) {
      const sql = fs.readFileSync(migration007, "utf-8")
      await query(sql)
    }

    // Migration 008: seed user@example.com / password123 (dev)
    const migration008 = path.join(__dirname, "../migrations/008_seed_dev_user.sql")
    if (fs.existsSync(migration008)) {
      const sql = fs.readFileSync(migration008, "utf-8")
      await query(sql)
    }

    // Migration 009: metadata_details (curl + response) cho agent test
    const migration009 = path.join(__dirname, "../migrations/009_agent_test_metadata_details.sql")
    if (fs.existsSync(migration009)) {
      const sql = fs.readFileSync(migration009, "utf-8")
      await query(sql)
    }

    // Migration 010: routing_hint trong config_json cho mỗi agent (gợi ý routing)
    const migration010 = path.join(__dirname, "../migrations/010_add_routing_hint.sql")
    if (fs.existsSync(migration010)) {
      const sql = fs.readFileSync(migration010, "utf-8")
      await query(sql)
    }

    // Migration 011: bảng faculties + cột hồ sơ users (full_name, position, faculty_id, intro, research_direction)
    const migration011 = path.join(__dirname, "../migrations/011_faculties_and_user_profile.sql")
    if (fs.existsSync(migration011)) {
      const sql = fs.readFileSync(migration011, "utf-8")
      await query(sql)
    }

    const migration012 = path.join(__dirname, "../migrations/012_publications.sql")
    if (fs.existsSync(migration012)) {
      const sql = fs.readFileSync(migration012, "utf-8")
      await query(sql)
    }

    const migration013 = path.join(__dirname, "../migrations/013_user_settings.sql")
    if (fs.existsSync(migration013)) {
      const sql = fs.readFileSync(migration013, "utf-8")
      await query(sql)
    }

    const migration014 = path.join(__dirname, "../migrations/014_research_projects.sql")
    if (fs.existsSync(migration014)) {
      const sql = fs.readFileSync(migration014, "utf-8")
      await query(sql)
    }

    const migration015 = path.join(__dirname, "../migrations/015_chat_sessions_source.sql")
    if (fs.existsSync(migration015)) {
      const sql = fs.readFileSync(migration015, "utf-8")
      await query(sql)
    }

    const migration016 = path.join(__dirname, "../migrations/016_daily_message_limits.sql")
    if (fs.existsSync(migration016)) {
      const sql = fs.readFileSync(migration016, "utf-8")
      await query(sql)
    }

    const migration017 = path.join(__dirname, "../migrations/017_chat_sessions_soft_delete.sql")
    if (fs.existsSync(migration017)) {
      const sql = fs.readFileSync(migration017, "utf-8")
      await query(sql)
    }

    const migration018 = path.join(__dirname, "../migrations/018_academic_title_degree.sql")
    if (fs.existsSync(migration018)) {
      const sql = fs.readFileSync(migration018, "utf-8")
      await query(sql)
    }

    const migration019 = path.join(__dirname, "../migrations/019_write_articles.sql")
    if (fs.existsSync(migration019)) {
      const sql = fs.readFileSync(migration019, "utf-8")
      await query(sql)
    }

    const migration020 = path.join(__dirname, "../migrations/020_user_daily_message_sends.sql")
    if (fs.existsSync(migration020)) {
      const sql = fs.readFileSync(migration020, "utf-8")
      await query(sql)
    }

    const migration021 = path.join(__dirname, "../migrations/021_user_role.sql")
    if (fs.existsSync(migration021)) {
      const sql = fs.readFileSync(migration021, "utf-8")
      await query(sql)
    }

    const migration022 = path.join(__dirname, "../migrations/022_write_articles_references.sql")
    if (fs.existsSync(migration022)) {
      const sql = fs.readFileSync(migration022, "utf-8")
      await query(sql)
    }

    const migration023 = path.join(__dirname, "../migrations/023_add_google_scholar_url.sql")
    if (fs.existsSync(migration023)) {
      const sql = fs.readFileSync(migration023, "utf-8")
      await query(sql)
    }

    const migration024 = path.join(__dirname, "../migrations/024_login_events.sql")
    if (fs.existsSync(migration024)) {
      const sql = fs.readFileSync(migration024, "utf-8")
      await query(sql)
    }

    const migration025 = path.join(__dirname, "../migrations/025_write_articles_share_token.sql")
    if (fs.existsSync(migration025)) {
      const sql = fs.readFileSync(migration025, "utf-8")
      await query(sql)
    }

    const migration026 = path.join(__dirname, "../migrations/026_remove_write_assistant.sql")
    if (fs.existsSync(migration026)) {
      const sql = fs.readFileSync(migration026, "utf-8")
      await query(sql)
    }

    const migration027 = path.join(__dirname, "../migrations/027_write_articles_research_id.sql")
    if (fs.existsSync(migration027)) {
      const sql = fs.readFileSync(migration027, "utf-8")
      await query(sql)
    }

    const migration028 = path.join(__dirname, "../migrations/028_write_article_comments.sql")
    if (fs.existsSync(migration028)) {
      const sql = fs.readFileSync(migration028, "utf-8")
      await query(sql)
    }

    const migration029 = path.join(__dirname, "../migrations/029_write_article_versions.sql")
    if (fs.existsSync(migration029)) {
      const sql = fs.readFileSync(migration029, "utf-8")
      await query(sql)
    }

    const migration030 = path.join(__dirname, "../migrations/030_add_regulations_assistant.sql")
    if (fs.existsSync(migration030)) {
      const sql = fs.readFileSync(migration030, "utf-8")
      await query(sql)
    }

    const migration031 = path.join(__dirname, "../migrations/031_chat_sessions_research_id.sql")
    if (fs.existsSync(migration031)) {
      const sql = fs.readFileSync(migration031, "utf-8")
      await query(sql)
    }

    const migration032 = path.join(__dirname, "../migrations/032_notifications.sql")
    if (fs.existsSync(migration032)) {
      const sql = fs.readFileSync(migration032, "utf-8")
      await query(sql)
    }

    const migration033 = path.join(__dirname, "../migrations/033_guest_user_and_device_limit.sql")
    if (fs.existsSync(migration033)) {
      const sql = fs.readFileSync(migration033, "utf-8")
      await query(sql)
    }

    const migration034 = path.join(__dirname, "../migrations/034_message_feedback.sql")
    if (fs.existsSync(migration034)) {
      const sql = fs.readFileSync(migration034, "utf-8")
      await query(sql)
    }

    const migration035 = path.join(__dirname, "../migrations/035_user_feedback.sql")
    if (fs.existsSync(migration035)) {
      const sql = fs.readFileSync(migration035, "utf-8")
      await query(sql)
    }

    const migration036 = path.join(__dirname, "../migrations/036_message_feedback_admin.sql")
    if (fs.existsSync(migration036)) {
      const sql = fs.readFileSync(migration036, "utf-8")
      await query(sql)
    }

    const migration037 = path.join(__dirname, "../migrations/037_research_projects_tags_icon.sql")
    if (fs.existsSync(migration037)) {
      const sql = fs.readFileSync(migration037, "utf-8")
      await query(sql)
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
        config: { routing_hint: "Chuyên gia, experts, người nghiên cứu" },
      },
      {
        alias: "data",
        icon: "Database",
        baseUrl: "http://localhost:3001/api/data_agent/v1",
        domainUrl: null,
        displayOrder: 4,
        config: { isInternal: true, routing_hint: "Dữ liệu, data, thống kê" },
      },
      {
        alias: "review",
        icon: "ListTodo",
        baseUrl: process.env.REVIEW_AGENT_URL || "http://localhost:8007/v1",
        domainUrl: "https://research.neu.edu.vn/api/agents/review",
        displayOrder: 5,
        config: { routing_hint: "Phản biện, review, đánh giá" },
      },
      {
        alias: "publish",
        icon: "Newspaper",
        baseUrl: "https://publication.neuresearch.workers.dev/v1",
        domainUrl: null,
        displayOrder: 6,
        config: { routing_hint: "Hội thảo, công bố, publication, conference, seminar, sự kiện khoa học" },
      },
      {
        alias: "funds",
        icon: "Award",
        baseUrl: "https://fund.neuresearch.workers.dev/v1",
        domainUrl: null,
        displayOrder: 7,
        config: { routing_hint: "Quỹ, tài trợ, funding" },
      },
      {
        alias: "plagiarism",
        icon: "ShieldCheck",
        baseUrl: process.env.PLAGIARISM_AGENT_URL || "http://10.2.13.53:8002/api/file-search/ai",
        domainUrl: "https://research.neu.edu.vn/api/agents/review",
        displayOrder: 8,
        config: { routing_hint: "Đạo văn, plagiarism, kiểm tra trùng lặp" },
      },
      {
        alias: "regulations",
        icon: "ShieldCheck",
        baseUrl: "http://localhost:3001/api/regulations_agent/v1",
        domainUrl: null,
        displayOrder: 9,
        config: { isInternal: true, routing_hint: "Quy chế, quy định, quy định NEU, quản lý khoa học, quy trình nghiên cứu" },
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
    const server = http.createServer(app)
    attachCollabWs(server)
    server.listen(PORT, () => {})
  })

export default app
