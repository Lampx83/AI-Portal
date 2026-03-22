import { Router, Request, Response } from "express"
import { spawn } from "child_process"
import fs from "fs"
import path from "path"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"

const router = Router()

function readBackendPackageVersion(): string {
  try {
    const p = path.resolve(__dirname, "../../../package.json")
    const raw = fs.readFileSync(p, "utf8")
    const json = JSON.parse(raw) as { version?: string }
    return typeof json.version === "string" && json.version.trim() ? json.version.trim() : "unknown"
  } catch {
    return "unknown"
  }
}

function getRunningBackendVersion(): { appVersion: string; buildTime: string } {
  const appVersion = process.env.APP_VERSION?.trim() || readBackendPackageVersion()
  const buildTime = process.env.BUILD_TIME?.trim() || "unknown"
  return { appVersion, buildTime }
}

router.get("/version", adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM ai_portal.app_settings WHERE key IN ('portal_release_version', 'portal_release_note')`
    )
    const map = Object.fromEntries(rows.rows.map((r) => [r.key, r.value]))
    const backend = getRunningBackendVersion()
    res.json({
      releaseVersion: map.portal_release_version ?? "",
      releaseNote: map.portal_release_note ?? "",
      backendVersion: backend.appVersion,
      backendBuildTime: backend.buildTime,
      frontendVersion: process.env.FRONTEND_APP_VERSION?.trim() || process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "",
      frontendBuildTime:
        process.env.FRONTEND_BUILD_TIME?.trim() || process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || "",
      now: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ error: "Lỗi lấy thông tin phiên bản", message: err?.message ?? String(err) })
  }
})

router.patch("/version", adminOnly, async (req: Request, res: Response) => {
  try {
    const releaseVersion = typeof req.body?.releaseVersion === "string" ? req.body.releaseVersion.trim() : ""
    const releaseNote = typeof req.body?.releaseNote === "string" ? req.body.releaseNote.trim() : ""
    await query(
      `INSERT INTO ai_portal.app_settings (key, value) VALUES
        ('portal_release_version', $1),
        ('portal_release_note', $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [releaseVersion, releaseNote]
    )
    res.json({ ok: true, releaseVersion, releaseNote })
  } catch (err: any) {
    res.status(500).json({ error: "Lỗi lưu phiên bản release", message: err?.message ?? String(err) })
  }
})

function resolveContainerName(service: string): string | null {
  const normalized = String(service || "").trim().toLowerCase()
  if (normalized === "backend") return process.env.BACKEND_CONTAINER_NAME || "aiportal-backend"
  if (normalized === "frontend") return process.env.FRONTEND_CONTAINER_NAME || "aiportal-frontend"
  return null
}

router.get("/logs", adminOnly, async (req: Request, res: Response) => {
  const service = String(req.query.service || "").trim().toLowerCase()
  const container = resolveContainerName(service)
  if (!container) return res.status(400).json({ error: "service phải là backend hoặc frontend" })
  const tailRaw = Number.parseInt(String(req.query.tail ?? "300"), 10)
  const tail = Number.isInteger(tailRaw) ? Math.max(50, Math.min(2000, tailRaw)) : 300
  const docker = spawn("docker", ["logs", "--tail", String(tail), container], { stdio: ["ignore", "pipe", "pipe"] })
  let out = ""
  let err = ""
  docker.stdout.on("data", (d) => {
    out += d.toString("utf8")
  })
  docker.stderr.on("data", (d) => {
    err += d.toString("utf8")
  })
  docker.on("error", (e) => {
    res.status(500).json({
      error: "Không thể chạy docker logs",
      message:
        "Backend cần có docker cli + quyền truy cập /var/run/docker.sock. " + (e?.message || "spawn error"),
    })
  })
  docker.on("close", (code) => {
    if (res.headersSent) return
    if (code !== 0) {
      return res.status(500).json({
        error: "Lấy logs thất bại",
        message: err || out || `docker logs exited with code ${code}`,
      })
    }
    res.json({ service, container, logs: (out || "").split("\n") })
  })
})

router.get("/logs/stream", adminOnly, async (req: Request, res: Response) => {
  const service = String(req.query.service || "").trim().toLowerCase()
  const container = resolveContainerName(service)
  if (!container) return res.status(400).json({ error: "service phải là backend hoặc frontend" })

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  })
  res.write(`event: meta\ndata: ${JSON.stringify({ service, container })}\n\n`)

  const docker = spawn("docker", ["logs", "--tail", "200", "-f", container], { stdio: ["ignore", "pipe", "pipe"] })

  const sendLine = (line: string) => {
    if (!line) return
    res.write(`event: line\ndata: ${JSON.stringify({ line })}\n\n`)
  }

  docker.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8")
    text.split(/\r?\n/).forEach(sendLine)
  })
  docker.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8")
    text.split(/\r?\n/).forEach((line: string) => sendLine(`[stderr] ${line}`))
  })
  docker.on("error", (e) => {
    res.write(`event: error\ndata: ${JSON.stringify({ message: e?.message || "spawn docker logs failed" })}\n\n`)
    res.end()
  })
  docker.on("close", (code) => {
    res.write(`event: end\ndata: ${JSON.stringify({ code })}\n\n`)
    res.end()
  })

  req.on("close", () => {
    try {
      docker.kill("SIGTERM")
    } catch {
      // ignore
    }
  })
})

export default router

