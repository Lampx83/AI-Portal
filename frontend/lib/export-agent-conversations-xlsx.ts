import * as XLSX from "xlsx"
import type { AdminChatMessage, AdminChatSession } from "@/lib/api/admin"

export type AgentConvExportLabels = {
  sheetSessions: string
  sheetMessages: string
  sessionId: string
  title: string
  agent: string
  source: string
  messageCount: string
  created: string
  updated: string
  order: string
  /** Cột đọc được: Người dùng / Trợ lý / … */
  senderDisplay: string
  role: string
  contentType: string
  content: string
  messageTime: string
  model: string
  attachments: string
  msgAssistant: string
  sourceWeb: string
  sourceEmbed: string
  roleUser: string
  roleAssistant: string
  roleSystem: string
  roleTool: string
  roleOther: string
}

function senderLabelForRole(role: string | undefined, labels: AgentConvExportLabels): string {
  const r = (role ?? "").toLowerCase().trim()
  if (r === "user") return labels.roleUser
  if (r === "assistant") return labels.roleAssistant
  if (r === "system") return labels.roleSystem
  if (r === "tool") return labels.roleTool
  if (!r) return labels.roleOther
  return `${labels.roleOther} (${role})`
}

function trimSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, "").trim()
  return cleaned.slice(0, 31) || "Sheet"
}

function formatAttachments(m: AdminChatMessage): string {
  const list = m.attachments
  if (!list?.length) return ""
  return list
    .map((a) => {
      const n = (a.file_name ?? "").trim()
      const u = (a.file_url ?? "").trim()
      if (n && u) return `${n} (${u})`
      return n || u
    })
    .filter(Boolean)
    .join("; ")
}

export function buildAgentConversationsWorkbook(
  sessions: AdminChatSession[],
  messagesBySessionId: Map<string, AdminChatMessage[]>,
  labels: AgentConvExportLabels
): XLSX.WorkBook {
  const sessionHeader: string[] = [
    labels.sessionId,
    labels.title,
    labels.agent,
    labels.source,
    labels.messageCount,
    labels.created,
    labels.updated,
  ]
  const sessionRows: (string | number)[][] = [sessionHeader]
  for (const s of sessions) {
    const src = s.source === "embed" ? labels.sourceEmbed : labels.sourceWeb
    sessionRows.push([
      s.id,
      s.title ?? "",
      s.assistant_alias,
      src,
      s.message_count,
      s.created_at ?? "",
      s.updated_at ?? "",
    ])
  }

  const msgHeader: string[] = [
    labels.sessionId,
    labels.title,
    labels.agent,
    labels.source,
    labels.order,
    labels.senderDisplay,
    labels.role,
    labels.contentType,
    labels.content,
    labels.messageTime,
    labels.model,
    labels.attachments,
    labels.msgAssistant,
  ]
  const msgRows: (string | number)[][] = [msgHeader]
  for (const s of sessions) {
    const msgs = messagesBySessionId.get(s.id) ?? []
    const src = s.source === "embed" ? labels.sourceEmbed : labels.sourceWeb
    msgs.forEach((m, idx) => {
      msgRows.push([
        s.id,
        s.title ?? "",
        s.assistant_alias,
        src,
        idx + 1,
        senderLabelForRole(m.role, labels),
        m.role,
        m.content_type,
        m.content ?? "",
        m.created_at ?? "",
        m.model_id ?? "",
        formatAttachments(m),
        m.assistant_alias ?? "",
      ])
    })
  }

  const wb = XLSX.utils.book_new()
  const wsSessions = XLSX.utils.aoa_to_sheet(sessionRows)
  const wsMessages = XLSX.utils.aoa_to_sheet(msgRows)
  wsSessions["!cols"] = [{ wch: 38 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 22 }]
  wsMessages["!cols"] = [
    { wch: 38 },
    { wch: 24 },
    { wch: 12 },
    { wch: 10 },
    { wch: 8 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 80 },
    { wch: 22 },
    { wch: 14 },
    { wch: 40 },
    { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsSessions, trimSheetName(labels.sheetSessions))
  XLSX.utils.book_append_sheet(wb, wsMessages, trimSheetName(labels.sheetMessages))
  return wb
}

export function downloadAgentConversationsXlsx(wb: XLSX.WorkBook, filenameBase: string) {
  const safe = filenameBase.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "agent-conversations"
  XLSX.writeFile(wb, `${safe}.xlsx`)
}
