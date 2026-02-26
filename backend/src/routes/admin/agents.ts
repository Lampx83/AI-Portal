import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { adminOnly } from "./middleware"
import { getBackendBaseUrl, SAMPLE_FILES } from "./shared"
import {
  getInternalAgentBaseUrlForTest,
  runAgentTestFull,
  runAgentTest,
  runWithRetry,
} from "./agent-test"

const router = Router()

// GET /api/admin/agents/export
router.get("/export", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT alias, icon, base_url, is_active, display_order, config_json
       FROM ai_portal.assistants
       ORDER BY display_order ASC, alias ASC`
    )
    const payload = {
      version: 1,
      schema: "ai_portal.assistants",
      exported_at: new Date().toISOString(),
      agents: (result.rows as any[]).map((r) => ({
        alias: r.alias,
        icon: r.icon ?? "Bot",
        base_url: r.base_url,
        is_active: r.is_active !== false,
        display_order: Number(r.display_order) || 0,
        config_json: r.config_json ?? {},
      })),
    }
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Disposition", 'attachment; filename="agents-export.json"')
    res.json(payload)
  } catch (err: any) {
    console.error("GET /agents/export error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

// POST /api/admin/agents/import
router.post("/import", adminOnly, async (req: Request, res: Response) => {
  try {
    const body = req.body as { agents?: any[]; version?: number }
    const list = Array.isArray(body?.agents) ? body.agents : []
    if (list.length === 0) {
      return res.status(400).json({ error: "Thiếu hoặc rỗng agents trong body" })
    }
    let count = 0
    for (const a of list) {
      const alias = String(a?.alias ?? "").trim()
      if (!alias) continue
      const icon = String(a?.icon ?? "Bot").trim() || "Bot"
      const base_url = String(a?.base_url ?? "").trim()
      if (!base_url) continue
      const is_active = a?.is_active !== false
      const display_order = Number(a?.display_order) || 0
      const config_json = a?.config_json != null ? a.config_json : {}
      await query(
        `INSERT INTO ai_portal.assistants (alias, icon, base_url, is_active, display_order, config_json)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (alias) DO UPDATE SET
           icon = EXCLUDED.icon,
           base_url = EXCLUDED.base_url,
           is_active = EXCLUDED.is_active,
           display_order = EXCLUDED.display_order,
           config_json = EXCLUDED.config_json,
           updated_at = now()`,
        [alias, icon, base_url, is_active, display_order, JSON.stringify(config_json)]
      )
      count++
    }
    res.json({
      success: true,
      message: `Đã nhập ${count} agent(s). Trùng alias sẽ được cập nhật.`,
      total: count,
    })
  } catch (err: any) {
    console.error("POST /agents/import error:", err)
    res.status(500).json({ error: err?.message || "Internal Server Error" })
  }
})

// GET /api/admin/agents
router.get("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, alias, icon, base_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.assistants
       ORDER BY display_order ASC, alias ASC`
    )
    const usageRows = await query(
      `SELECT s.assistant_alias AS alias, COUNT(*)::int AS daily_used
       FROM ai_portal.messages m
       JOIN ai_portal.chat_sessions s ON s.id = m.session_id
       WHERE m.role = 'user' AND m.created_at >= date_trunc('day', now())
       GROUP BY s.assistant_alias`
    )
    const usageByAlias: Record<string, number> = {}
    for (const row of usageRows.rows as { alias: string; daily_used: number }[]) {
      usageByAlias[row.alias] = row.daily_used ?? 0
    }
    const agents = (result.rows as any[]).map((a) => {
      const config = a.config_json ?? {}
      const daily_message_limit = config.daily_message_limit != null ? Number(config.daily_message_limit) : 100
      const displayName = typeof config.displayName === "string" ? config.displayName.trim() : ""
      return {
        ...a,
        name: displayName || a.alias,
        daily_message_limit:
          Number.isInteger(daily_message_limit) && daily_message_limit >= 0 ? daily_message_limit : 100,
        daily_used: usageByAlias[a.alias] ?? 0,
      }
    })
    res.json({ agents })
  } catch (err: any) {
    console.error("Error fetching agents:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/agents/test-results
router.get("/test-results", adminOnly, async (req: Request, res: Response) => {
  try {
    const loadAll = req.query.all === "true" || req.query.all === "1"
    const limit = loadAll ? 100000 : Math.min(Number(req.query.limit) || 20, 100)
    const offset = loadAll ? 0 : Math.max(Number(req.query.offset) || 0, 0)
    const runs = await query(
      loadAll
        ? `SELECT r.id, r.run_at, r.total_agents, r.passed_count
           FROM ai_portal.agent_test_runs r
           ORDER BY r.run_at DESC`
        : `SELECT r.id, r.run_at, r.total_agents, r.passed_count
           FROM ai_portal.agent_test_runs r
           ORDER BY r.run_at DESC
           LIMIT $1 OFFSET $2`,
      loadAll ? [] : [limit, offset]
    )
    const runIds = runs.rows.map((r: { id: string }) => r.id)
    let results: Record<string, unknown[]> = {}
    if (runIds.length > 0) {
      const placeholders = runIds.map((_, i) => `$${i + 1}`).join(",")
      const resRows = await query(
        `SELECT run_id, agent_alias, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass,
                metadata_ms, data_documents_ms, data_experts_ms, ask_text_ms, ask_file_ms, error_message,
                metadata_details, data_details, ask_text_details, ask_file_details
         FROM ai_portal.agent_test_results WHERE run_id IN (${placeholders})
         ORDER BY run_id, agent_alias`,
        runIds
      )
      for (const row of resRows.rows) {
        const rid = String(row.run_id ?? "")
        if (!results[rid]) results[rid] = []
        results[rid].push(row)
      }
    }
    const runsWithStringId = runs.rows.map(
      (r: { id: unknown; run_at: unknown; total_agents: unknown; passed_count: unknown }) => ({
        ...r,
        id: String(r.id ?? ""),
      })
    )
    res.json({ runs: runsWithStringId, results })
  } catch (err: any) {
    console.error("Error fetching test results:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// POST /api/admin/agents/test-all-stream
router.post("/test-all-stream", adminOnly, async (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")
  res.setHeader("X-Accel-Buffering", "no")
  res.flushHeaders?.()
  const send = (event: string, data: object) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    if (typeof (res as any).flush === "function") (res as any).flush()
  }
  const startTime = Date.now()
  try {
    const agentIdsFilter = Array.isArray(req.body?.agent_ids)
      ? (req.body.agent_ids as string[]).filter((id: string) => typeof id === "string" && id.length > 0)
      : null
    const backendUrl = getBackendBaseUrl(req)
    const sampleUrlsByFormat: Record<string, string> = {}
    SAMPLE_FILES.forEach((f) => {
      const ext = f.replace(/^.*\./, "").toLowerCase()
      sampleUrlsByFormat[ext] = `${backendUrl}/api/admin/sample-files/${f}`
    })
    let agentsResult: { rows: { id: string; alias: string; base_url: string }[] }
    if (agentIdsFilter && agentIdsFilter.length > 0) {
      agentsResult = await query(
        `SELECT id, alias, base_url FROM ai_portal.assistants
         WHERE id::text = ANY($1::text[]) OR alias = ANY($1::text[])
         ORDER BY display_order, alias`,
        [agentIdsFilter]
      )
    } else {
      agentsResult = await query(
        `SELECT id, alias, base_url FROM ai_portal.assistants WHERE is_active = true ORDER BY display_order, alias`
      )
    }
    const agents = agentsResult.rows as { id: string; alias: string; base_url: string }[]
    if (agents.length === 0) {
      send("error", { message: "Không có agent nào được chọn để test" })
      res.end()
      return
    }
    const runResult = await query(
      `INSERT INTO ai_portal.agent_test_runs (total_agents, passed_count) VALUES ($1, 0) RETURNING id, run_at`,
      [agents.length]
    )
    const runId = runResult.rows[0].id
    send("start", { run_id: runId, total: agents.length })
    let passedCount = 0
    let aborted = false
    let testedCount = 0
    req.on("close", () => {
      aborted = true
    })
    for (let i = 0; i < agents.length; i++) {
      if (aborted) break
      testedCount = i + 1
      const agent = agents[i]
      const baseUrl =
        agent.alias === "central"
          ? getInternalAgentBaseUrlForTest(agent.alias)
          : String(agent.base_url || "").replace(/\/+$/, "")
      let metadataPass: boolean | null = null
      let dataDocumentsPass: boolean | null = null
      let dataExpertsPass: boolean | null = null
      let askTextPass: boolean | null = null
      let askFilePass: boolean | null = null
      let metadataMs: number | null = null
      let dataDocumentsMs: number | null = null
      let dataExpertsMs: number | null = null
      let askTextMs: number | null = null
      let askFileMs: number | null = null
      let errorMsg: string | null = null
      let metadataDetails: { curl?: string; response?: unknown } | null = null
      let dataDetails: { type: string; pass: boolean; ms: number; curl?: string; response?: unknown }[] = []
      let askTextDetails: { model_id: string; pass: boolean; ms: number; curl?: string; response?: unknown }[] = []
      let askFileDetails: { format: string; pass: boolean; ms: number; curl?: string; response?: unknown }[] = []
      let modelId = "gpt-4o-mini"
      let prompt = "Xin chào, bạn có thể giúp gì tôi?"
      const supportedModels: { model_id: string; accepted_file_types?: string[] }[] = []
      send("agent", { index: i + 1, total: agents.length, alias: agent.alias })
      try {
        send("endpoint", { agent: agent.alias, endpoint: "/metadata", status: "running" })
        const tMeta = Date.now()
        const metaRes = await runWithRetry(() => runAgentTestFull(baseUrl, "metadata"), {
          onRetry: (n) =>
            send("endpoint", { agent: agent.alias, endpoint: "/metadata", status: "retrying", attempt: n }),
        })
        metadataMs = Date.now() - tMeta
        metadataPass = metaRes.ok
        metadataDetails = { curl: metaRes.curl, response: metaRes.data }
        send("endpoint", {
          agent: agent.alias,
          endpoint: "/metadata",
          pass: metaRes.ok,
          status: metaRes.status,
          result: metaRes.data,
          duration_ms: metadataMs,
        })
        let dataTypes: string[] = ["documents", "experts"]
        if (metaRes.ok && metaRes.data) {
          const m = metaRes.data as Record<string, unknown>
          const models = (m?.supported_models as { model_id?: string; accepted_file_types?: string[] }[]) || []
          supportedModels.length = 0
          models.forEach((mod) => {
            if (mod?.model_id)
              supportedModels.push({ model_id: mod.model_id, accepted_file_types: mod.accepted_file_types })
          })
          if (supportedModels.length > 0) modelId = supportedModels[0].model_id
          const prompts = (m?.sample_prompts as string[]) || []
          if (prompts.length > 0 && typeof prompts[0] === "string") prompt = prompts[0]
          const pdt = (m?.provided_data_types as { type?: string }[]) || []
          const extracted = pdt
            .map((dt: { type?: string }) => (typeof dt === "string" ? dt : dt?.type))
            .filter(Boolean) as string[]
          if (extracted.length > 0) {
            dataTypes = extracted
          }
        }
        for (const dataType of dataTypes) {
          send("endpoint", { agent: agent.alias, endpoint: `/data?type=${dataType}`, status: "running" })
          const t0 = Date.now()
          const res = await runWithRetry(
            () => runAgentTestFull(baseUrl, "data", { dataType }),
            {
              onRetry: (n) =>
                send("endpoint", {
                  agent: agent.alias,
                  endpoint: `/data?type=${dataType}`,
                  status: "retrying",
                  attempt: n,
                }),
            }
          )
          const ms = Date.now() - t0
          dataDetails.push({ type: dataType, pass: res.ok, ms, curl: res.curl, response: res.data })
          send("endpoint", {
            agent: agent.alias,
            endpoint: `/data?type=${dataType}`,
            pass: res.ok,
            status: res.status,
            result: res.data,
            duration_ms: ms,
          })
        }
        dataDocumentsPass = dataDetails[0]?.pass ?? null
        dataExpertsPass = dataDetails[1]?.pass ?? null
        dataDocumentsMs = dataDetails[0]?.ms ?? null
        dataExpertsMs = dataDetails[1]?.ms ?? null
        for (const mod of supportedModels.length > 0 ? supportedModels : [{ model_id: modelId }]) {
          const mid = mod.model_id || modelId
          send("endpoint", { agent: agent.alias, endpoint: `/ask (text) ${mid}`, status: "running" })
          const t0 = Date.now()
          const res = await runWithRetry(
            () => runAgentTestFull(baseUrl, "ask", { modelId: mid, prompt }),
            {
              onRetry: (n) =>
                send("endpoint", {
                  agent: agent.alias,
                  endpoint: `/ask (text) ${mid}`,
                  status: "retrying",
                  attempt: n,
                }),
            }
          )
          const ms = Date.now() - t0
          askTextDetails.push({ model_id: mid, pass: res.ok, ms, curl: res.curl, response: res.data })
          send("endpoint", {
            agent: agent.alias,
            endpoint: `/ask (text) ${mid}`,
            pass: res.ok,
            status: res.status,
            duration_ms: ms,
          })
        }
        askTextPass = askTextDetails.length > 0 && askTextDetails.every((d) => d.pass)
        askTextMs =
          askTextDetails.length > 0
            ? Math.round(askTextDetails.reduce((a, d) => a + d.ms, 0) / askTextDetails.length)
            : null
        const acceptedFormats = new Set<string>()
        supportedModels.forEach((mod) =>
          (mod.accepted_file_types || []).forEach((f: string) =>
            acceptedFormats.add(String(f).toLowerCase().replace(/^\./, ""))
          )
        )
        const formatsToTest =
          acceptedFormats.size > 0 ? Array.from(acceptedFormats) : Object.keys(sampleUrlsByFormat)
        for (const format of formatsToTest) {
          const fileUrl = sampleUrlsByFormat[format]
          if (!fileUrl) continue
          send("endpoint", { agent: agent.alias, endpoint: `/ask (file) ${format}`, status: "running" })
          const t0 = Date.now()
          const res = await runWithRetry(
            () => runAgentTestFull(baseUrl, "ask", { modelId, prompt, documentUrls: [fileUrl] }),
            {
              onRetry: (n) =>
                send("endpoint", {
                  agent: agent.alias,
                  endpoint: `/ask (file) ${format}`,
                  status: "retrying",
                  attempt: n,
                }),
            }
          )
          const ms = Date.now() - t0
          askFileDetails.push({ format, pass: res.ok, ms, curl: res.curl, response: res.data })
          send("endpoint", {
            agent: agent.alias,
            endpoint: `/ask (file) ${format}`,
            pass: res.ok,
            status: res.status,
            duration_ms: ms,
          })
        }
        askFilePass =
          askFileDetails.length > 0 ? askFileDetails.every((d) => d.pass) : null
        askFileMs =
          askFileDetails.length > 0
            ? Math.round(askFileDetails.reduce((a, d) => a + d.ms, 0) / askFileDetails.length)
            : null
        const corePass = metadataPass === true && askTextPass === true
        if (corePass) passedCount++
      } catch (e: any) {
        errorMsg = e?.message || String(e)
        send("endpoint", { agent: agent.alias, endpoint: "error", pass: false, error: errorMsg })
      }
      send("agent_result", {
        agent_alias: agent.alias,
        metadata_pass: metadataPass,
        data_documents_pass: dataDocumentsPass,
        data_experts_pass: dataExpertsPass,
        ask_text_pass: askTextPass,
        ask_file_pass: askFilePass,
        metadata_ms: metadataMs,
        data_documents_ms: dataDocumentsMs,
        data_experts_ms: dataExpertsMs,
        ask_text_ms: askTextMs,
        ask_file_ms: askFileMs,
        error_message: errorMsg,
        metadata_details: metadataDetails,
        data_details: dataDetails,
        ask_text_details: askTextDetails,
        ask_file_details: askFileDetails,
      })
      await query(
        `INSERT INTO ai_portal.agent_test_results
         (run_id, agent_id, agent_alias, base_url, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, metadata_ms, data_documents_ms, data_experts_ms, ask_text_ms, ask_file_ms, error_message, metadata_details, data_details, ask_text_details, ask_file_details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb)`,
        [
          runId,
          agent.id,
          agent.alias,
          baseUrl,
          metadataPass,
          dataDocumentsPass,
          dataExpertsPass,
          askTextPass,
          askFilePass,
          metadataMs,
          dataDocumentsMs,
          dataExpertsMs,
          askTextMs,
          askFileMs,
          errorMsg,
          metadataDetails ? JSON.stringify(metadataDetails) : null,
          JSON.stringify(dataDetails),
          JSON.stringify(askTextDetails),
          JSON.stringify(askFileDetails),
        ]
      )
    }
    const actualTested = aborted ? testedCount : agents.length
    await query(
      `UPDATE ai_portal.agent_test_runs SET passed_count = $1, total_agents = $2 WHERE id = $3`,
      [passedCount, actualTested, runId]
    )
    const durationMs = Date.now() - startTime
    if (aborted) {
      try {
        send("stopped", { run_id: runId, tested: actualTested, passed_count: passedCount })
      } catch (_) {}
    } else {
      send("done", {
        run_id: runId,
        total: agents.length,
        passed_count: passedCount,
        duration_ms: durationMs,
        duration_str: `${(durationMs / 1000).toFixed(1)}s`,
      })
    }
  } catch (err: any) {
    send("error", { message: err?.message || String(err) })
  } finally {
    res.end()
  }
})

// POST /api/admin/agents/test-all
router.post("/test-all", adminOnly, async (req: Request, res: Response) => {
  try {
    const backendUrl = getBackendBaseUrl(req)
    const sampleFileUrl = `${backendUrl}/api/admin/sample-files/sample.pdf`

    const agentsResult = await query(
      `SELECT id, alias, base_url FROM ai_portal.assistants WHERE is_active = true ORDER BY display_order, alias`
    )
    const agents = agentsResult.rows as { id: string; alias: string; base_url: string }[]

    const runResult = await query(
      `INSERT INTO ai_portal.agent_test_runs (total_agents, passed_count) VALUES ($1, 0) RETURNING id, run_at`,
      [agents.length]
    )
    const runId = runResult.rows[0].id

    let passedCount = 0
    for (const agent of agents) {
      const baseUrl =
        agent.alias === "central"
          ? getInternalAgentBaseUrlForTest(agent.alias)
          : String(agent.base_url || "").replace(/\/+$/, "")
      let metadataPass: boolean | null = null
      let dataDocumentsPass: boolean | null = null
      let dataExpertsPass: boolean | null = null
      let askTextPass: boolean | null = null
      let askFilePass: boolean | null = null
      let errorMsg: string | null = null
      let modelId = "gpt-4o-mini"
      let prompt = "Xin chào, bạn có thể giúp gì tôi?"

      try {
        const metaRes = await runAgentTest(baseUrl, "metadata")
        metadataPass = metaRes.ok
        let dataType1 = "documents"
        let dataType2 = "experts"
        if (metaRes.ok) {
          const metaData = (await fetch(`${baseUrl}/metadata`).then((r) =>
            r.json().catch(() => ({}))
          )) as Record<string, unknown>
          const models = (metaData?.supported_models as { model_id?: string }[]) || []
          if (models.length > 0 && models[0]?.model_id) modelId = models[0].model_id
          const prompts = (metaData?.sample_prompts as string[]) || []
          if (prompts.length > 0 && typeof prompts[0] === "string") prompt = prompts[0]
          const pdt = (metaData?.provided_data_types as { type?: string }[]) || []
          const extracted = pdt
            .map((dt: { type?: string }) => (typeof dt === "string" ? dt : dt?.type))
            .filter(Boolean) as string[]
          if (extracted.length > 0) {
            dataType1 = extracted[0]
            dataType2 = extracted[1] ?? extracted[0]
          }
        }

        const docRes = await runAgentTest(baseUrl, "data", { dataType: dataType1 })
        dataDocumentsPass = docRes.ok

        if (dataType1 !== dataType2) {
          const expRes = await runAgentTest(baseUrl, "data", { dataType: dataType2 })
          dataExpertsPass = expRes.ok
        } else {
          dataExpertsPass = null
        }

        const askTextRes = await runAgentTest(baseUrl, "ask", { modelId, prompt })
        askTextPass = askTextRes.ok

        const askFileRes = await runAgentTest(baseUrl, "ask", {
          modelId,
          prompt,
          documentUrls: [sampleFileUrl],
        })
        askFilePass = askFileRes.ok

        const corePass = metadataPass === true && askTextPass === true
        if (corePass) passedCount++
      } catch (e: any) {
        errorMsg = e?.message || String(e)
      }

      await query(
        `INSERT INTO ai_portal.agent_test_results
         (run_id, agent_id, agent_alias, base_url, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          runId,
          agent.id,
          agent.alias,
          baseUrl,
          metadataPass,
          dataDocumentsPass,
          dataExpertsPass,
          askTextPass,
          askFilePass,
          errorMsg,
        ]
      )
    }

    await query(`UPDATE ai_portal.agent_test_runs SET passed_count = $1 WHERE id = $2`, [
      passedCount,
      runId,
    ])

    const results = await query(
      `SELECT agent_alias, metadata_pass, data_documents_pass, data_experts_pass, ask_text_pass, ask_file_pass, error_message
       FROM ai_portal.agent_test_results WHERE run_id = $1 ORDER BY agent_alias`,
      [runId]
    )

    res.json({
      ok: true,
      run_id: runId,
      run_at: runResult.rows[0].run_at,
      total: agents.length,
      passed_count: passedCount,
      results: results.rows,
    })
  } catch (err: any) {
    console.error("Agent test-all error:", err)
    res.status(500).json({
      error: "Test thất bại",
      message: err?.message || String(err),
    })
  }
})

// POST /api/admin/agents/test
router.post("/test", adminOnly, async (req: Request, res: Response) => {
  try {
    const { base_url, test_type, model_id, prompt, document_urls, data_type } = req.body
    if (!base_url || typeof base_url !== "string") {
      return res.status(400).json({ error: "base_url là bắt buộc" })
    }
    const baseUrl = base_url.replace(/\/+$/, "")
    const timeout = 30000

    if (test_type === "metadata") {
      const url = `${baseUrl}/metadata`
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout),
      })
      const data = await resp.json().catch(() => ({}))
      return res.json({ ok: resp.ok, status: resp.status, url, data })
    }

    if (test_type === "data") {
      const type = data_type || "documents"
      const url = `${baseUrl}/data?type=${encodeURIComponent(type)}`
      const resp = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(timeout),
      })
      const data = await resp.json().catch(() => ({}))
      return res.json({ ok: resp.ok, status: resp.status, url, data })
    }

    if (test_type === "ask") {
      const url = `${baseUrl}/ask`
      const session_id = `test-${Date.now()}`
      const payload: Record<string, unknown> = {
        session_id,
        model_id: model_id || "gpt-4o-mini",
        user: "admin-test",
        prompt: typeof prompt === "string" ? prompt : "Xin chào, bạn có thể giúp gì tôi?",
        context:
          Array.isArray(document_urls) && document_urls.length > 0
            ? {
                extra_data: {
                  document: document_urls.filter((u: unknown) => typeof u === "string"),
                },
              }
            : {},
      }
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      })
      const data = await resp.json().catch(() => ({}))
      return res.json({ ok: resp.ok, status: resp.status, url, data })
    }

    return res.status(400).json({ error: "test_type phải là metadata, data, hoặc ask" })
  } catch (err: any) {
    console.error("Agent test error:", err)
    res.status(500).json({
      error: "Test thất bại",
      message: err?.message || String(err),
    })
  }
})

// DELETE /api/admin/agents/:id
router.delete("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `UPDATE ai_portal.assistants
       SET is_active = false, updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING id, alias`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    res.json({ message: "Agent đã được xóa (ẩn). Có thể khôi phục sau.", agent: result.rows[0] })
  } catch (err: any) {
    console.error("Error deleting agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// DELETE /api/admin/agents/:id/permanent
router.delete("/:id/permanent", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const check = await query(
      `SELECT id, alias, is_active FROM ai_portal.assistants WHERE id = $1::uuid`,
      [id]
    )
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    const row = check.rows[0] as { alias: string; is_active: boolean }
    if (row.alias === "central") {
      return res.status(400).json({ error: "Không được xóa vĩnh viễn trợ lý chính (central)" })
    }
    if (row.is_active) {
      return res.status(400).json({ error: "Vui lòng xóa (ẩn) agent trước, sau đó mới xóa vĩnh viễn" })
    }
    await query(`DELETE FROM ai_portal.assistants WHERE id = $1::uuid`, [id])
    res.json({ message: "Đã xóa vĩnh viễn agent khỏi database" })
  } catch (err: any) {
    console.error("Error permanent delete agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// GET /api/admin/agents/:id
router.get("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    const result = await query(
      `SELECT id, alias, icon, base_url, is_active, display_order, config_json, created_at, updated_at
       FROM ai_portal.assistants
       WHERE id = $1::uuid`,
      [id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    res.json({ agent: result.rows[0] })
  } catch (err: any) {
    console.error("Error fetching agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// POST /api/admin/agents
router.post("/", adminOnly, async (req: Request, res: Response) => {
  try {
    const { alias, icon, base_url, display_order, config_json } = req.body

    if (!alias || !base_url) {
      return res.status(400).json({ error: "alias và base_url là bắt buộc" })
    }

    const result = await query(
      `INSERT INTO ai_portal.assistants (alias, icon, base_url, display_order, config_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, alias, icon, base_url, is_active, display_order, config_json, created_at, updated_at`,
      [alias, icon || "Bot", base_url, display_order || 0, JSON.stringify(config_json || {})]
    )

    res.status(201).json({ agent: result.rows[0] })
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Agent với alias này đã tồn tại" })
    }
    console.error("Error creating agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

// PATCH /api/admin/agents/:id
router.patch("/:id", adminOnly, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id).trim()
    let { alias, icon, base_url, is_active, display_order, config_json, daily_message_limit } =
      req.body

    const current = await query(
      `SELECT alias FROM ai_portal.assistants WHERE id = $1::uuid LIMIT 1`,
      [id]
    )
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }
    const currentAlias = (current.rows[0] as { alias: string }).alias
    if (
      currentAlias === "central" &&
      alias !== undefined &&
      String(alias).trim().toLowerCase() !== "central"
    ) {
      return res
        .status(400)
        .json({
          error: "Không được đổi alias của Trợ lý chính (Central). Cấu hình LLM tại Admin → Central.",
        })
    }
    if (currentAlias === "central") {
      alias = undefined
    }

    let finalConfigJson = config_json
    if (daily_message_limit !== undefined) {
      let base: Record<string, unknown> =
        typeof config_json === "object" && config_json !== null ? { ...config_json } : {}
      if (
        Object.keys(base).length === 0 ||
        (config_json === undefined && daily_message_limit !== undefined)
      ) {
        const cur = await query(
          `SELECT config_json FROM ai_portal.assistants WHERE id = $1::uuid LIMIT 1`,
          [id]
        )
        base = ((cur.rows[0] as { config_json?: Record<string, unknown> } | undefined)?.config_json ??
          {}) as Record<string, unknown>
      }
      const n = Number(daily_message_limit)
      const value = Number.isInteger(n) && n >= 0 ? n : 100
      finalConfigJson = { ...base, daily_message_limit: value }
    }

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (alias !== undefined) {
      updates.push(`alias = $${paramIndex++}`)
      values.push(alias)
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`)
      values.push(icon)
    }
    if (base_url !== undefined) {
      updates.push(`base_url = $${paramIndex++}`)
      values.push(base_url)
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }
    if (display_order !== undefined) {
      updates.push(`display_order = $${paramIndex++}`)
      values.push(display_order)
    }
    if (finalConfigJson !== undefined) {
      updates.push(`config_json = $${paramIndex++}::jsonb`)
      values.push(JSON.stringify(finalConfigJson))
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Không có trường nào để cập nhật" })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id)

    const result = await query(
      `UPDATE ai_portal.assistants
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex}::uuid
       RETURNING id, alias, icon, base_url, is_active, display_order, config_json, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Agent không tồn tại" })
    }

    res.json({ agent: result.rows[0] })
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Agent với alias này đã tồn tại" })
    }
    console.error("Error updating agent:", err)
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

export default router
