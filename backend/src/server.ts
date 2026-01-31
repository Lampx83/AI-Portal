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
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
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
