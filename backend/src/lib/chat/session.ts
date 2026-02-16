// lib/chat/session.ts
import { query } from "../db"
import { getOrCreateUserByEmail } from "./user"
import { UUID_RE, GUEST_USER_ID, SYSTEM_USER_ID } from "./constants"

export type CreateSessionIfMissingOpts = {
  sessionId: string
  userId?: string | null
  assistantAlias?: string | null
  title?: string | null
  modelId?: string | null
  source?: string | null
  projectId?: string | null
}

/** Ensure session exists (insert on conflict do nothing). Create system/guest user if needed. */
export async function createSessionIfMissing(opts: CreateSessionIfMissingOpts): Promise<void> {
  const {
    sessionId,
    userId = null,
    assistantAlias = null,
    title = null,
    modelId = null,
    source = "web",
    projectId = null,
  } = opts

  const finalSource = source === "embed" ? "embed" : "web"
  const finalAssistantAlias = assistantAlias || "central"
  const finalProjectId = projectId && UUID_RE.test(projectId) ? projectId : null

  try {
    const finalUserId = await getOrCreateUserByEmail(userId)

    if (finalUserId === SYSTEM_USER_ID) {
      await query(
        `
      INSERT INTO ai_portal.users (id, email, display_name, created_at, updated_at)
      SELECT 
        '00000000-0000-0000-0000-000000000000'::uuid,
        'system@portal.local',
        'System User',
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM ai_portal.users WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
      )
      `,
        []
      )
    }

    if (finalUserId === GUEST_USER_ID) {
      await query(
        `
      INSERT INTO ai_portal.users (id, email, display_name, created_at, updated_at)
      SELECT $1::uuid, 'guest@portal.local', 'Khách', NOW(), NOW()
      WHERE NOT EXISTS (SELECT 1 FROM ai_portal.users WHERE id = $1::uuid)
      `,
        [GUEST_USER_ID]
      )
    }

    await query(
      `
    INSERT INTO ai_portal.chat_sessions (id, user_id, assistant_alias, title, model_id, source, project_id)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid)
    ON CONFLICT (id) DO NOTHING
    `,
      [sessionId, finalUserId, finalAssistantAlias, title, modelId, finalSource, finalProjectId]
    )

    if (finalUserId === GUEST_USER_ID) {
      await query(
        `UPDATE ai_portal.chat_sessions SET user_id = $1::uuid WHERE id = $2::uuid AND user_id = '00000000-0000-0000-0000-000000000000'::uuid`,
        [GUEST_USER_ID, sessionId]
      )
    }
  } catch (err: any) {
    console.error("❌ Failed to create session:", err)
    console.error("   Session ID:", sessionId)
    console.error("   User ID (original):", userId)
    console.error("   Assistant Alias:", finalAssistantAlias)
    console.error("   Error code:", err?.code)
    console.error("   Error message:", err?.message)
    throw err
  }
}
