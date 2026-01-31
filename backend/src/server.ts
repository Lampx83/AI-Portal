// server.ts
// IMPORTANT: Load environment variables FIRST before any other imports
import "./lib/env"

import express, { Request, Response, NextFunction } from "express"
import cors from "cors"
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

// Root route - Admin panel (chỉ trong development hoặc khi ENABLE_ADMIN_ROUTES=true)
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
        researchAssistants: "/api/research-assistants"
      },
      note: "Admin panel chỉ khả dụng trong development mode hoặc khi ENABLE_ADMIN_ROUTES=true"
    })
  }
  
  // Serve admin view từ admin route
  // Redirect đến /api/admin/view để sử dụng logic đã có sẵn
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

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`)
  const corsOriginsDisplay = Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(", ") : CORS_ORIGIN
  console.log(`📡 CORS enabled for: ${corsOriginsDisplay}`)
})

export default app
