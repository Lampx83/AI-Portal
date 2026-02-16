// lib/chat/message.ts
import { query } from "../db"

export type HistTurn = { role: "user" | "assistant"; content: string }

export type AppendMessageInput = {
  role: "user" | "assistant"
  content: string
  content_type?: "markdown" | "text" | "json"
  model_id?: string | null
  status?: "ok" | "error"
  assistant_alias?: string | null
  prompt_tokens?: number | null
  completion_tokens?: number | null
  total_tokens?: number | null
  response_time_ms?: number | null
  refs?: any
}

/** Get last N turns (user/assistant, status ok) for session, oldest first. */
export async function getRecentTurns(sessionId: string, limit = 5): Promise<HistTurn[]> {
  const { rows } = await query(
    `
    SELECT role, content
    FROM ai_portal.messages
    WHERE session_id = $1::uuid
      AND status = 'ok'
      AND role IN ('user','assistant')
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [sessionId, limit]
  )
  return rows.reverse().map((r: any) => ({
    role: r.role,
    content: String(r.content ?? ""),
  }))
}

/** Append a message to session. client: optional pg client for transaction. Returns message id or null. */
export async function appendMessage(
  sessionId: string,
  m: AppendMessageInput,
  client?: any
): Promise<string | null> {
  const {
    role,
    content,
    content_type = "markdown",
    model_id = null,
    status = "ok",
    assistant_alias = null,
    prompt_tokens = null,
    completion_tokens = null,
    total_tokens = null,
    response_time_ms = null,
    refs = null,
  } = m

  const queryFn = client ? client.query.bind(client) : query

  const r = await queryFn(
    `
    INSERT INTO ai_portal.messages (
      session_id, assistant_alias,
      role, status, content_type, content,
      model_id, prompt_tokens, completion_tokens, total_tokens,
      response_time_ms, refs
    )
    VALUES (
      $1::uuid, $2,
      $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12
    )
    RETURNING id
    `,
    [
      sessionId,
      assistant_alias,
      role,
      status,
      content_type,
      String(content ?? ""),
      model_id,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      response_time_ms,
      refs,
    ]
  )
  return r?.rows?.[0]?.id ?? null
}

/** Attach file list (url, name) to message. client: optional for transaction. */
export async function insertAttachments(
  messageId: string,
  docs: { url: string; name?: string }[],
  client?: any
): Promise<void> {
  if (!docs?.length) return
  const queryFn = client ? client.query.bind(client) : query
  for (const doc of docs) {
    const url = String(doc.url || "").trim()
    if (!url) continue
    const name = doc.name ?? url.split("/").pop()?.split("?")[0] ?? null
    await queryFn(
      `INSERT INTO ai_portal.message_attachments (message_id, file_url, file_name)
       VALUES ($1::uuid, $2, $3)`,
      [messageId, url, name]
    )
  }
}
