/**
 * Lịch sử phiên trợ lý — lưu CỤC BỘ trong userData, tách theo máy chủ + tài khoản + dự án
 * (không lưu trong thư mục dự án, để thư mục dùng chung/đồng bộ không lộ hội thoại của người dùng).
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import type { AgentSession, AgentSessionSummary, TranscriptItem } from "../../shared/api"
import type { ChatMsg } from "./llmClient"

export interface StoredSession extends AgentSession {
  /** Hội thoại gửi cho mô hình (đã rút gọn kết quả công cụ cũ). */
  llm: ChatMsg[]
}

const ID_RE = /^[0-9a-f-]{36}$/
const MAX_SESSIONS = 100
const MAX_TRANSCRIPT = 1000

export class SessionStore {
  constructor(private readonly dirFor: (projectId: string) => string) {}

  private file(projectId: string, id: string): string {
    if (!ID_RE.test(id)) throw new Error("Mã phiên không hợp lệ")
    return path.join(this.dirFor(projectId), `${id}.json`)
  }

  create(projectId: string, title: string): StoredSession {
    const now = new Date().toISOString()
    const s: StoredSession = { id: crypto.randomUUID(), title: title.slice(0, 80) || "Phiên mới", createdAt: now, updatedAt: now, transcript: [], llm: [] }
    this.save(projectId, s)
    this.prune(projectId)
    return s
  }

  get(projectId: string, id: string): StoredSession | null {
    try {
      const s = JSON.parse(fs.readFileSync(this.file(projectId, id), "utf8")) as StoredSession
      if (!s || s.id !== id || !Array.isArray(s.transcript)) return null
      if (!Array.isArray(s.llm)) s.llm = []
      return s
    } catch {
      return null
    }
  }

  save(projectId: string, s: StoredSession): void {
    s.updatedAt = new Date().toISOString()
    if (s.transcript.length > MAX_TRANSCRIPT) s.transcript = s.transcript.slice(-MAX_TRANSCRIPT)
    const f = this.file(projectId, s.id)
    fs.mkdirSync(path.dirname(f), { recursive: true, mode: 0o700 })
    const tmp = `${f}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(s), { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmp, f)
  }

  list(projectId: string): AgentSessionSummary[] {
    let names: string[] = []
    try {
      names = fs.readdirSync(this.dirFor(projectId)).filter((n) => /^[0-9a-f-]{36}\.json$/.test(n))
    } catch {
      return []
    }
    const out: AgentSessionSummary[] = []
    for (const n of names) {
      const s = this.get(projectId, n.slice(0, 36))
      if (s) out.push({ id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt })
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  delete(projectId: string, id: string): boolean {
    try {
      fs.unlinkSync(this.file(projectId, id))
      return true
    } catch {
      return false
    }
  }

  private prune(projectId: string): void {
    const all = this.list(projectId)
    for (const s of all.slice(MAX_SESSIONS)) this.delete(projectId, s.id)
  }

  static toView(s: StoredSession): AgentSession {
    return { id: s.id, title: s.title, createdAt: s.createdAt, updatedAt: s.updatedAt, transcript: s.transcript as TranscriptItem[] }
  }
}
