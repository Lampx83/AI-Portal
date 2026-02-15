#!/usr/bin/env node
/**
 * Copy agents từ thư mục nguồn (AGENTS_SOURCE_PATH) vào backend/src/agents/<name>/.
 * Mỗi agent là một thư mục con có manifest.json.
 * Chạy từ backend: AGENTS_SOURCE_PATH="../../AI Agents" npm run install-agents
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.join(__dirname, "..")
const agentsDestDir = path.join(backendRoot, "src", "agents")
const defaultSource = path.join(backendRoot, "..", "..", "AI Agents")
const sourceDir = path.resolve(process.env.AGENTS_SOURCE_PATH || defaultSource)

if (!fs.existsSync(sourceDir)) {
  console.error("Thư mục nguồn agents không tồn tại:", sourceDir)
  console.error("Gợi ý: set AGENTS_SOURCE_PATH hoặc đặt thư mục 'AI Agents' cùng cấp với 'AI Portal'.")
  process.exit(1)
}

fs.mkdirSync(agentsDestDir, { recursive: true })

const entries = fs.readdirSync(sourceDir, { withFileTypes: true })
let installed = 0
for (const ent of entries) {
  if (!ent.isDirectory()) continue
  const agentPath = path.join(sourceDir, ent.name)
  const manifestPath = path.join(agentPath, "manifest.json")
  if (!fs.existsSync(manifestPath)) continue
  const destPath = path.join(agentsDestDir, ent.name)
  fs.cpSync(agentPath, destPath, { recursive: true, force: true })
  console.log("Installed agent:", ent.name, "->", destPath)
  installed++
}

console.log("Done. Installed", installed, "agent(s). Restart backend to load them.")
