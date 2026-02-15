#!/usr/bin/env node
/**
 * Xuất danh sách agents (ai_portal.assistants) ra file JSON để lưu và import sau.
 * Chạy từ backend: npm run export-agents
 * Output: data/agents-export.json (trong thư mục backend)
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import pg from "pg"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// No .env: use process.env (set by shell or Docker). Defaults for local run.
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "postgres",
  user: process.env.POSTGRES_USER ?? "postgres",
  password: process.env.POSTGRES_PASSWORD ?? "postgres",
  ssl: process.env.POSTGRES_SSL === "true" ? { rejectUnauthorized: false } : undefined,
})

async function main() {
  const client = await pool.connect()
  try {
    const res = await client.query(
      `SELECT alias, icon, base_url, domain_url, is_active, display_order, config_json
       FROM ai_portal.assistants
       ORDER BY display_order ASC, alias ASC`
    )
    const payload = {
      version: 1,
      schema: "ai_portal.assistants",
      exported_at: new Date().toISOString(),
      agents: (res.rows || []).map((r) => ({
        alias: r.alias,
        icon: r.icon ?? "Bot",
        base_url: r.base_url,
        domain_url: r.domain_url ?? null,
        is_active: r.is_active !== false,
        display_order: Number(r.display_order) || 0,
        config_json: r.config_json ?? {},
      })),
    }
    const dataDir = path.join(backendRoot, "data")
    fs.mkdirSync(dataDir, { recursive: true })
    const outPath = path.join(dataDir, "agents-export.json")
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8")
    console.log("Đã xuất", payload.agents.length, "agent(s) ra", outPath)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
