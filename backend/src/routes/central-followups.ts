// routes/central-followups.ts — POST /api/chat/followups: 2–3 câu hỏi gợi ý tiếp theo sau câu trả lời của Trợ lý chính.
// Gọi SAU khi câu trả lời chính đã xong nên không làm chậm câu trả lời. Không tính vào hạn mức tin nhắn.
import { Router, Request, Response } from "express"
import rateLimit from "express-rate-limit"
import OpenAI from "openai"
import { query } from "../lib/db"
import { authorizeSessionAccess, getCaller } from "../lib/chat/access"
import { UUID_RE } from "../lib/chat/constants"
import { getCentralLlmCredentials, llmExtraBody } from "../lib/central-agent-config"
import { getToolsManifestsForCentral } from "../lib/tools"
import { normalizeLifecycle, LIFECYCLE_STAGES } from "../lib/project-lifecycle"
import { buildFollowupMessages, detectLang, parseLlmFollowups, ruleFollowups, MAX_FOLLOWUPS } from "../lib/central-followups"

const router = Router()

/** Mỗi IP tối đa 30 lần/phút (mỗi câu trả lời gọi 1 lần). */
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { suggestions: [], error: "rate_limited" },
})

const LLM_TIMEOUT_MS = 8_000
/** Số lời gọi mô hình gợi ý chạy đồng thời tối đa — quá thì dùng luật, không xếp hàng tranh GPU với câu trả lời chính. */
const MAX_INFLIGHT_LLM = 4
let inflight = 0

type Mode = "llm" | "rules" | "off"
let modeCache: { mode: Mode; at: number } | null = null
async function getMode(): Promise<Mode> {
  if (modeCache && Date.now() - modeCache.at < 60_000) return modeCache.mode
  let mode: Mode = "llm"
  try {
    const r = await query<{ value: string }>(`SELECT value FROM ai_portal.app_settings WHERE key = 'central_followups_mode' LIMIT 1`)
    const v = String(r.rows[0]?.value ?? "").trim().toLowerCase()
    if (v === "rules" || v === "off" || v === "llm") mode = v
  } catch {
    /* mặc định llm */
  }
  modeCache = { mode, at: Date.now() }
  return mode
}

async function projectStage(req: Request, projectId: string): Promise<{ id: string; name: string } | null> {
  if (!UUID_RE.test(projectId)) return null
  try {
    const caller = await getCaller(req)
    if (!caller.id) return null
    const r = await query<{ user_id: string; team_members: unknown; lifecycle: unknown }>(
      `SELECT user_id, team_members, lifecycle FROM ai_portal.projects WHERE id = $1::uuid LIMIT 1`,
      [projectId]
    )
    const p = r.rows[0]
    if (!p) return null
    const members = JSON.stringify(p.team_members ?? []).toLowerCase()
    const ok = caller.isAdmin || p.user_id === caller.id || (!!caller.email && members.includes(caller.email.toLowerCase()))
    if (!ok) return null
    const lc = normalizeLifecycle(p.lifecycle)
    if (!lc.stages.some((s) => s.status !== "todo")) return null
    const def = LIFECYCLE_STAGES[lc.currentStage]
    return def ? { id: def.id, name: def.name } : null
  } catch {
    return null
  }
}

router.post("/", limiter, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as { session_id?: unknown; tools_used?: unknown; project_id?: unknown; locale?: unknown }
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : ""
    if (!UUID_RE.test(sessionId)) return res.status(400).json({ suggestions: [], error: "invalid_session" })
    if (!(await authorizeSessionAccess(req, res, sessionId))) return

    const mode = await getMode()
    if (mode === "off") return res.json({ suggestions: [], source: "off" })

    const msgs = await query<{ role: string; content: string | null; assistant_alias: string | null }>(
      `SELECT role::text AS role, content, assistant_alias FROM ai_portal.messages
       WHERE session_id = $1::uuid ORDER BY created_at DESC LIMIT 4`,
      [sessionId]
    )
    const rows = msgs.rows
    const lastAssistantIdx = rows.findIndex((m) => m.role === "assistant")
    if (lastAssistantIdx !== 0) return res.json({ suggestions: [], source: "none" }) // câu cuối chưa phải trả lời của trợ lý
    const answer = String(rows[0].content ?? "")
    const question = String(rows.slice(1).find((m) => m.role === "user")?.content ?? "")
    const alias = rows[0].assistant_alias
    if (alias && alias !== "central" && alias !== "main") return res.json({ suggestions: [], source: "none" })

    const manifests = await getToolsManifestsForCentral().catch(() => [])
    const availableAliases = manifests.map((m) => m.alias)
    const toolsUsed = (Array.isArray(body.tools_used) ? body.tools_used : [])
      .filter((x): x is string => typeof x === "string" && availableAliases.includes(x))
      .slice(0, 5)
    const stage = typeof body.project_id === "string" ? await projectStage(req, body.project_id.trim()) : null
    const lang = detectLang(question, typeof body.locale === "string" ? body.locale : undefined)
    const rules = ruleFollowups({ toolsUsed, stageId: stage?.id ?? null, lang, question, availableAliases })

    if (mode === "rules" || inflight >= MAX_INFLIGHT_LLM || !answer.trim()) {
      return res.json({ suggestions: rules, source: "rules" })
    }

    const cred = await getCentralLlmCredentials().catch(() => null)
    if (!cred) return res.json({ suggestions: rules, source: "rules" })

    inflight++
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS)
    try {
      const client = new OpenAI({
        apiKey: cred.apiKey,
        ...(cred.baseUrl ? { baseURL: cred.baseUrl } : {}),
        ...(cred.extraHeaders && Object.keys(cred.extraHeaders).length ? { defaultHeaders: cred.extraHeaders } : {}),
        maxRetries: 0,
      })
      const completion = await client.chat.completions.create(
        {
          model: cred.model,
          messages: buildFollowupMessages({ question, answer, lang, toolNames: manifests.map((m) => m.name), stageName: stage?.name }),
          temperature: 0.3,
          max_tokens: 160,
          ...llmExtraBody(cred),
        } as any,
        { signal: ctrl.signal }
      )
      const text = (completion as any)?.choices?.[0]?.message?.content ?? ""
      const fromLlm = parseLlmFollowups(String(text), question)
      if (fromLlm.length >= 2) return res.json({ suggestions: fromLlm.slice(0, MAX_FOLLOWUPS), source: "llm" })
      // ít quá → bù bằng luật
      const merged = [...fromLlm]
      for (const r of rules) if (merged.length < MAX_FOLLOWUPS && !merged.includes(r)) merged.push(r)
      return res.json({ suggestions: merged, source: fromLlm.length ? "mixed" : "rules" })
    } catch (e: any) {
      if (e?.name !== "AbortError") console.warn("[central-followups] llm failed:", e?.message ?? e)
      return res.json({ suggestions: rules, source: "rules" })
    } finally {
      clearTimeout(timer)
      inflight--
    }
  } catch (err: any) {
    console.error("POST /api/chat/followups error:", err?.message ?? err)
    if (!res.headersSent) res.status(500).json({ suggestions: [], error: "internal" })
  }
})

export default router
