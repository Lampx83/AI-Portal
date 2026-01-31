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
        agents: "/api/agents"
      },
      note: "Admin panel chỉ khả dụng trong development mode hoặc khi ENABLE_ADMIN_ROUTES=true"
    })
  }
  
  // Serve admin view từ admin route
  // Redirect đến /api/admin/view để sử dụng logic đã có sẵn
  res.redirect("/api/admin/view")
})

// Routes
app.use("/api/chat", require("./routes/chat").default)
app.use("/api/orchestrator", require("./routes/orchestrator").default)
app.use("/api/agents", require("./routes/agents").default)
app.use("/api/upload", require("./routes/upload").default)
app.use("/api/demo_agent", require("./routes/demo-agent").default)
app.use("/api/main_agent", require("./routes/main-agent").default)
app.use("/api/write_agent", require("./routes/write-agent").default)
app.use("/api/data_agent", require("./routes/data-agent").default)
app.use("/api/users", require("./routes/users").default)
app.use("/api/admin", require("./routes/admin").default)

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
  console.log(`📡 CORS enabled for: ${CORS_ORIGIN}`)
})

export default app
