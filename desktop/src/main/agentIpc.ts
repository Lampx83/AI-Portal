/**
 * IPC cho trợ lý thư mục (giai đoạn 2). Cùng mô hình kiểm tra người gửi với ipc.ts:
 * chỉ khung chính của cửa sổ do app tạo, đang ở trang thuộc hệ thống.
 *
 * Ghi tệp / hoàn tác: preload chỉ gửi khi trang có «user activation» (người dùng vừa bấm thật), và tiến trình chính
 * hiện hộp thoại xác nhận của hệ điều hành (trừ khi người dùng đã chọn «không hỏi lại» cho dự án trong phiên chạy này).
 * Nhờ vậy mã độc trên trang web (nếu có) không tự ghi tệp được.
 */
import crypto from "crypto"
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent, type WebContents } from "electron"
import os from "os"
import path from "path"
import { CHANNELS, type AgentEvent, type AgentStatus, type ChangeView } from "../shared/api"
import { AuthError, type DesktopAuth } from "./auth"
import { FolderAgent } from "./agent/agent"
import { ChangeService } from "./agent/changes"
import { HttpChatClient } from "./agent/llmClient"
import { SessionStore, type StoredSession } from "./agent/sessions"
import { AgentTools } from "./agent/tools"
import { assertPortalSender } from "./ipc"
import type { PortalTarget } from "./policy"
import { assertProjectId, type ProjectFolderService } from "./projectFolders"

export interface ConfirmRequest {
  kind: "accept" | "undo"
  change: ChangeView
}

export interface AgentIpcDeps {
  folders: ProjectFolderService
  auth: DesktopAuth
  getPortal: () => PortalTarget
  isAppWindow: (wc: WebContents) => boolean
  userDataDir: string
  /** Hộp thoại xác nhận của hệ điều hành → { ok, trust } */
  confirm: (win: BrowserWindow | null, req: ConfirmRequest) => Promise<{ ok: boolean; trust: boolean }>
  /** Các webContents nhận sự kiện của trợ lý. */
  listeners: () => WebContents[]
}

interface Scope {
  key: string
  changes: ChangeService
  sessions: SessionStore
  agent: FolderAgent
}

const SESSION_ID_RE = /^[0-9a-f-]{36}$/

export function registerAgentIpc(deps: AgentIpcDeps): { stopAll: () => void } {
  const scopes = new Map<string, Scope>()
  const runs = new Map<string, { ctrl: AbortController; projectId: string; scopeKey: string; sessionId: string }>()
  const trusted = new Set<string>()

  const originKey = () => {
    const p = deps.getPortal()
    return crypto.createHash("sha256").update(p.origin + p.basePath).digest("hex").slice(0, 16)
  }

  /** Phạm vi lưu trữ theo máy chủ + tài khoản. */
  const scope = (): Scope => {
    const user = deps.auth.user()
    if (!user) throw new AuthError("Ứng dụng chưa kết nối với tài khoản. Bấm «Kết nối» trong khung Trợ lý thư mục.", "not_connected")
    const uid = user.id.replace(/[^0-9a-zA-Z-]/g, "")
    const key = `${originKey()}/${uid}`
    let s = scopes.get(key)
    if (!s) {
      const base = path.join(deps.userDataDir, "agent", originKey(), uid)
      const projDir = (projectId: string) => path.join(base, assertProjectId(projectId))
      const changes = new ChangeService({ resolveRoot: (pid) => deps.folders.resolveFolder(pid), storeFile: (pid) => path.join(projDir(pid), "changes.json") })
      const sessions = new SessionStore((pid) => path.join(projDir(pid), "sessions"))
      const client = new HttpChatClient((p, init) => deps.auth.authorizedFetch(p, init))
      const agent = new FolderAgent({ client, tools: new AgentTools(deps.folders, changes), sessions, changes, folders: deps.folders })
      s = { key, changes, sessions, agent }
      scopes.set(key, s)
    }
    return s
  }

  const broadcast = (ev: AgentEvent) => {
    for (const wc of deps.listeners()) {
      if (!wc.isDestroyed()) wc.send(CHANNELS.agentEvent, ev)
    }
  }

  const handle = (channel: string, fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, async (e, ...args) => {
      assertPortalSender(e, deps)
      return fn(e, ...args)
    })
  }

  const status = async (verify: boolean): Promise<AgentStatus> => {
    const p = deps.getPortal()
    const user = deps.auth.user()
    const st: AgentStatus = { connected: !!user, server: p.url, secureStorage: deps.auth.secureStorage() }
    if (user) st.user = { email: user.email, name: user.name }
    if (user && verify) {
      try {
        const res = await deps.auth.authorizedFetch("/api/desktop/me", { method: "GET" })
        if (res.ok) {
          const b = (await res.json()) as { llm?: { available?: boolean; model?: string | null } }
          st.llm = { available: !!b.llm?.available, model: b.llm?.model ?? null }
        } else if (res.status === 401) {
          st.connected = false
          delete st.user
        } else st.error = `HTTP ${res.status}`
      } catch (e) {
        if (e instanceof AuthError && e.status === 401) {
          st.connected = false
          delete st.user
        }
        st.error = (e as Error).message
      }
    }
    return st
  }

  handle(CHANNELS.agentStatus, () => status(true))

  handle(CHANNELS.agentConnect, async () => {
    await deps.auth.connect()
    return status(true)
  })

  handle(CHANNELS.agentDisconnect, async () => {
    for (const [id, r] of runs) {
      r.ctrl.abort()
      runs.delete(id)
    }
    await deps.auth.disconnect()
    return status(false)
  })

  handle(CHANNELS.agentListSessions, (_e, projectId) => {
    const pid = assertProjectId(projectId)
    return scope().sessions.list(pid)
  })

  handle(CHANNELS.agentGetSession, (_e, projectId, sessionId) => {
    const pid = assertProjectId(projectId)
    if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) return null
    const s = scope().sessions.get(pid, sessionId)
    if (!s) return null
    const running = [...runs.entries()].find(([, r]) => r.sessionId === sessionId)?.[0] ?? null
    return { ...SessionStore.toView(s), running }
  })

  handle(CHANNELS.agentDeleteSession, (_e, projectId, sessionId) => {
    const pid = assertProjectId(projectId)
    if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) return false
    for (const [id, r] of runs) {
      if (r.sessionId === sessionId) {
        r.ctrl.abort()
        runs.delete(id)
      }
    }
    const sc = scope()
    sc.changes.dropPending(pid, sessionId)
    return sc.sessions.delete(pid, sessionId)
  })

  handle(CHANNELS.agentSend, async (_e, projectId, sessionId, text) => {
    const pid = assertProjectId(projectId)
    if (typeof text !== "string" || !text.trim()) throw new Error("Câu hỏi trống")
    deps.folders.resolveFolder(pid) // phải có thư mục đã liên kết
    const sc = scope()
    if ([...runs.values()].some((r) => r.projectId === pid && r.scopeKey === sc.key)) {
      throw new Error("Trợ lý đang xử lý một yêu cầu khác của dự án này. Hãy chờ hoặc bấm Dừng.")
    }
    let session: StoredSession | null = null
    if (typeof sessionId === "string" && SESSION_ID_RE.test(sessionId)) session = sc.sessions.get(pid, sessionId)
    if (!session) session = sc.sessions.create(pid, text.trim().replace(/\s+/g, " ").slice(0, 60))
    const runId = crypto.randomUUID()
    const ctrl = new AbortController()
    runs.set(runId, { ctrl, projectId: pid, scopeKey: sc.key, sessionId: session.id })
    const s = session
    void sc.agent
      .run({ runId, projectId: pid, session: s, text, signal: ctrl.signal, emit: broadcast })
      .catch((err) => {
        broadcast({ type: "run_end", runId, projectId: pid, sessionId: s.id, status: "error", message: String((err as Error)?.message ?? err), usage: { promptTokens: 0, completionTokens: 0, steps: 0 } })
      })
      .finally(() => runs.delete(runId))
    return { runId, sessionId: s.id }
  })

  handle(CHANNELS.agentStop, (_e, runId) => {
    const r = typeof runId === "string" ? runs.get(runId) : undefined
    if (!r) return false
    r.ctrl.abort()
    return true
  })

  handle(CHANNELS.agentListChanges, (_e, projectId, sessionId) => {
    const pid = assertProjectId(projectId)
    return scope().changes.list(pid, { sessionId: typeof sessionId === "string" && SESSION_ID_RE.test(sessionId) ? sessionId : undefined })
  })

  const confirmAndRun = async (e: IpcMainInvokeEvent, kind: "accept" | "undo", projectId: unknown, changeId: unknown, activation: unknown) => {
    const pid = assertProjectId(projectId)
    if (typeof changeId !== "string" || !SESSION_ID_RE.test(changeId)) throw new Error("Mã thay đổi không hợp lệ")
    if (activation !== true) throw new Error("Cần bấm nút để xác nhận (thao tác tự động bị từ chối)")
    const sc = scope()
    const view = sc.changes.toView(sc.changes.get(pid, changeId))
    const tKey = `${sc.key}/${pid}`
    if (!trusted.has(tKey)) {
      const r = await deps.confirm(BrowserWindow.fromWebContents(e.sender), { kind, change: view })
      if (!r.ok) throw new Error("Đã huỷ")
      if (r.trust) trusted.add(tKey)
    }
    return kind === "accept" ? sc.changes.accept(pid, changeId) : sc.changes.undo(pid, changeId)
  }

  handle(CHANNELS.agentAccept, (e, projectId, changeId, activation) => confirmAndRun(e, "accept", projectId, changeId, activation))
  handle(CHANNELS.agentUndo, (e, projectId, changeId, activation) => confirmAndRun(e, "undo", projectId, changeId, activation))
  handle(CHANNELS.agentReject, (_e, projectId, changeId) => {
    const pid = assertProjectId(projectId)
    if (typeof changeId !== "string" || !SESSION_ID_RE.test(changeId)) throw new Error("Mã thay đổi không hợp lệ")
    return scope().changes.reject(pid, changeId)
  })

  return {
    stopAll: () => {
      for (const r of runs.values()) r.ctrl.abort()
      runs.clear()
    },
  }
}

export function deviceName(): string {
  const h = os.hostname().replace(/\.local$/i, "")
  const plat = process.platform === "darwin" ? "macOS" : process.platform === "win32" ? "Windows" : process.platform
  return `${h || "Máy tính"} (${plat})`.slice(0, 120)
}
