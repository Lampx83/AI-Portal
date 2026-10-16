/**
 * Vòng lặp tool-calling của trợ lý thư mục (tiến trình chính).
 *
 * Giới hạn mỗi lượt: số bước gọi mô hình, số công cụ mỗi bước, số đề xuất ghi, tổng token, thời gian.
 * Ngữ cảnh luôn được rút gọn để vừa mô hình 32k token (vLLM Qwen3.5): kết quả công cụ của lượt cũ bị cắt,
 * lượt quá cũ bị bỏ; máy chủ trả 413 thì rút gọn mạnh hơn và thử lại một lần.
 * Người dùng dừng được bất cứ lúc nào (AbortSignal).
 */
import type { AgentEvent, TranscriptItem } from "../../shared/api"
import type { ProjectFolderService } from "../projectFolders"
import type { ChangeService } from "./changes"
import { LlmError, type ChatClient, type ChatMsg } from "./llmClient"
import type { SessionStore, StoredSession } from "./sessions"
import { isWriteTool, TOOL_DEFS, type AgentTools } from "./tools"

export interface RunLimits {
  maxSteps: number
  maxToolCallsPerStep: number
  maxProposalsPerRun: number
  maxTokensPerRun: number
  maxRunMs: number
  /** Ngân sách ký tự của toàn bộ ngữ cảnh gửi đi (ước lượng ~2.5 ký tự/token). */
  contextChars: number
  maxOutputTokens: number
  /** Kết quả công cụ của các lượt trước bị cắt còn chừng này ký tự. */
  oldToolResultChars: number
  /** Độ dài tối đa tin nhắn người dùng. */
  maxUserChars: number
}

export const DEFAULT_LIMITS: RunLimits = {
  maxSteps: 12,
  maxToolCallsPerStep: 8,
  maxProposalsPerRun: 20,
  maxTokensPerRun: 200_000,
  maxRunMs: 10 * 60_000,
  contextChars: 52_000,
  maxOutputTokens: 3000,
  oldToolResultChars: 400,
  maxUserChars: 8000,
}

function size(m: ChatMsg): number {
  return (m.content?.length ?? 0) + (m.tool_calls ?? []).reduce((s, t) => s + t.function.arguments.length + t.function.name.length + 20, 0) + 16
}

function cut(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}\n[… đã rút gọn ${s.length - n} ký tự]`
}

/**
 * Rút gọn hội thoại để vừa `budget` ký tự. `keepFrom` = chỉ số tin nhắn người dùng của lượt hiện tại
 * (không bỏ lượt hiện tại). Tin nhắn [0] là system, luôn giữ.
 */
export function compactMessages(msgs: ChatMsg[], budget: number, keepFrom: number, oldToolChars = 400): { messages: ChatMsg[]; keepFrom: number } {
  let out = msgs.map((m, i) => {
    if (i === 0 || i >= keepFrom) return m
    if (m.role === "tool" && m.content) return { ...m, content: cut(m.content, oldToolChars) }
    if (m.role === "assistant" && m.content && m.content.length > 3000) return { ...m, content: cut(m.content, 3000) }
    return m
  })
  const total = () => out.reduce((s, m) => s + size(m), 0)
  // Bỏ các lượt cũ nhất (theo nhóm bắt đầu bằng tin nhắn user).
  while (total() > budget) {
    const firstUser = out.findIndex((m, i) => i > 0 && m.role === "user")
    if (firstUser < 0 || firstUser >= keepFrom) break
    let next = out.findIndex((m, i) => i > firstUser && m.role === "user")
    if (next < 0 || next > keepFrom) next = keepFrom
    if (next === firstUser) break
    const removed = next - firstUser
    out = [...out.slice(0, firstUser), ...out.slice(next)]
    keepFrom -= removed
  }
  // Vẫn vượt: cắt kết quả công cụ lớn nhất trong lượt hiện tại.
  let guard = 0
  while (total() > budget && guard++ < 50) {
    let idx = -1
    let len = 1500
    out.forEach((m, i) => {
      if (i >= keepFrom && m.role === "tool" && (m.content?.length ?? 0) > len) {
        idx = i
        len = m.content!.length
      }
    })
    if (idx < 0) break
    const over = total() - budget
    out[idx] = { ...out[idx], content: cut(out[idx].content!, Math.max(1200, len - over - 200)) }
  }
  return { messages: out, keepFrom }
}

export function buildSystemPrompt(folderName: string, overview: string, today: string): string {
  return [
    "Bạn là «Trợ lý thư mục» của ứng dụng NEU Research (Hệ thống hỗ trợ nghiên cứu khoa học dựa trên AI của Đại học Kinh tế Quốc dân).",
    `Bạn làm việc với MỘT thư mục dự án trên máy người dùng: «${folderName}». Hôm nay: ${today}.`,
    "Quy tắc:",
    "- Trả lời bằng ngôn ngữ người dùng dùng (mặc định tiếng Việt), ngắn gọn, rõ ràng; nêu tên tệp khi dựa vào tệp.",
    "- Chỉ dùng thông tin đọc được từ tệp (list_files, read_file, search_text) hoặc người dùng cung cấp. Không bịa nội dung tệp, số liệu hay tài liệu tham khảo.",
    "- Đọc tệp trước khi sửa. Sửa nhỏ dùng edit_file (old_text chép NGUYÊN VĂN từ read_file); tạo tệp mới hoặc viết lại toàn bộ dùng write_file.",
    "- Mọi thay đổi (tạo, sửa, đổi tên, xoá) chỉ là ĐỀ XUẤT: người dùng xem diff rồi tự bấm Chấp nhận/Từ chối. Không bao giờ nói là đã ghi/lưu xong; hãy nói «đã đề xuất, mời bạn duyệt».",
    "- Khi người dùng yêu cầu sửa/tạo/viết lại tệp: đọc tệp rồi GỌI NGAY edit_file hoặc write_file để tạo đề xuất trong cùng lượt này. KHÔNG hỏi lại «bạn có muốn…», KHÔNG chỉ liệt kê chỗ cần sửa — giao diện đã có nút Chấp nhận/Từ chối để người dùng quyết định.",
    "- Chỉ đề xuất thay đổi khi người dùng yêu cầu. Không xoá tệp trừ khi được yêu cầu rõ ràng.",
    "- Khi được hỏi tóm tắt/nhận xét/tìm thông tin: PHẢI đọc nội dung tệp liên quan bằng read_file (hoặc search_text) trước khi trả lời; không tóm tắt chỉ dựa vào tên tệp hay kích thước. Thư mục nhiều tệp thì đọc các tệp chính trước và nói rõ đã đọc tệp nào.",
    "- Không chạy được lệnh, chương trình hay mã; không truy cập Internet; chỉ trong thư mục này.",
    "- Với .docx: sửa từng cụm trong một đoạn bằng edit_file để giữ định dạng. Với .pdf/.xlsx: chỉ đọc; nếu cần kết quả hãy tạo tệp mới (.md, .csv…).",
    "- Tệp dài: đọc theo phần (start_line/end_line), đừng đọc lại những gì đã có.",
    "- Khi xong việc, tóm tắt kết quả và các đề xuất đang chờ duyệt.",
    "",
    "Tổng quan thư mục (cấp đầu):",
    overview,
  ].join("\n")
}

export interface AgentDeps {
  client: ChatClient
  tools: AgentTools
  sessions: SessionStore
  changes: ChangeService
  folders: ProjectFolderService
  limits?: Partial<RunLimits>
  now?: () => Date
}

export interface RunOptions {
  runId: string
  projectId: string
  session: StoredSession
  text: string
  signal: AbortSignal
  emit: (e: AgentEvent) => void
}

export class FolderAgent {
  readonly limits: RunLimits

  constructor(private readonly deps: AgentDeps) {
    this.limits = { ...DEFAULT_LIMITS, ...(deps.limits ?? {}) }
  }

  private overview(projectId: string): { name: string; text: string } {
    const info = this.deps.folders.get(projectId)
    const name = info?.name ?? "thư mục"
    try {
      const r = this.deps.folders.listFiles(projectId, "")
      const lines = r.entries.slice(0, 80).map((e) => (e.type === "dir" ? `${e.name}/` : e.name))
      if (r.entries.length > 80 || r.truncated) lines.push(`… (còn ${r.entries.length - 80} mục)`)
      return { name, text: lines.length ? lines.join("\n") : "(thư mục trống)" }
    } catch (e) {
      return { name, text: `(không đọc được: ${(e as Error).message})` }
    }
  }

  async run(o: RunOptions): Promise<void> {
    const L = this.limits
    const t0 = Date.now()
    const now = () => (this.deps.now ? this.deps.now() : new Date()).toISOString()
    const s = o.session
    const push = (item: TranscriptItem) => s.transcript.push(item)
    const usage = { promptTokens: 0, completionTokens: 0, steps: 0 }
    let status: "done" | "stopped" | "error" | "limit" = "done"
    let message: string | undefined
    let proposals = 0

    const text = o.text.trim().slice(0, L.maxUserChars)
    push({ kind: "user", text, at: now() })
    if (s.transcript.filter((x) => x.kind === "user").length === 1) s.title = text.replace(/\s+/g, " ").slice(0, 60)
    o.emit({ type: "run_start", runId: o.runId, projectId: o.projectId, sessionId: s.id })

    const ov = this.overview(o.projectId)
    const system: ChatMsg = { role: "system", content: buildSystemPrompt(ov.name, ov.text, now().slice(0, 10)) }
    let msgs: ChatMsg[] = [system, ...s.llm.filter((m) => m.role !== "system"), { role: "user", content: text }]
    let keepFrom = msgs.length - 1

    try {
      for (;;) {
        if (o.signal.aborted) throw new DOMException("aborted", "AbortError")
        if (usage.steps >= L.maxSteps) {
          status = "limit"
          message = `Đã đạt giới hạn ${L.maxSteps} bước trong một lượt. Bạn có thể nhắn «tiếp tục».`
          break
        }
        if (Date.now() - t0 > L.maxRunMs) {
          status = "limit"
          message = "Lượt này chạy quá lâu nên đã dừng. Bạn có thể nhắn «tiếp tục»."
          break
        }
        usage.steps++
        let c = compactMessages(msgs, L.contextChars, keepFrom, L.oldToolResultChars)
        msgs = c.messages
        keepFrom = c.keepFrom
        let res
        try {
          res = await this.deps.client.chat(
            { messages: msgs, tools: TOOL_DEFS, maxTokens: L.maxOutputTokens },
            { signal: o.signal, onDelta: (t) => o.emit({ type: "delta", runId: o.runId, text: t }) },
          )
        } catch (e) {
          if (e instanceof LlmError && e.code === "context_too_large") {
            c = compactMessages(msgs, Math.floor(L.contextChars * 0.55), keepFrom, 200)
            msgs = c.messages
            keepFrom = c.keepFrom
            res = await this.deps.client.chat({ messages: msgs, tools: TOOL_DEFS, maxTokens: L.maxOutputTokens }, { signal: o.signal })
          } else throw e
        }
        usage.promptTokens += res.usage.promptTokens
        usage.completionTokens += res.usage.completionTokens
        const calls = res.toolCalls.slice(0, 16)
        msgs.push({ role: "assistant", content: res.content || (calls.length ? "" : ""), ...(calls.length ? { tool_calls: calls } : {}) })
        if (res.content.trim()) {
          push({ kind: "assistant", text: res.content.trim(), at: now() })
          o.emit({ type: "assistant", runId: o.runId, text: res.content.trim() })
        }
        if (calls.length === 0) break

        for (const [i, call] of calls.entries()) {
          if (o.signal.aborted) {
            msgs.push({ role: "tool", tool_call_id: call.id, content: "Người dùng đã dừng." })
            continue
          }
          const name = call.function.name
          if (i >= L.maxToolCallsPerStep) {
            msgs.push({ role: "tool", tool_call_id: call.id, content: `Lỗi: tối đa ${L.maxToolCallsPerStep} công cụ mỗi bước — gọi lại ở bước sau.` })
            continue
          }
          if (isWriteTool(name) && proposals >= L.maxProposalsPerRun) {
            msgs.push({ role: "tool", tool_call_id: call.id, content: `Lỗi: đã đạt giới hạn ${L.maxProposalsPerRun} đề xuất trong một lượt. Hãy dừng và nhờ người dùng duyệt.` })
            continue
          }
          let label = ""
          try {
            const a = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>
            label = String(a.path ?? a.from ?? a.query ?? "")
          } catch {
            /* bỏ qua */
          }
          o.emit({ type: "tool_start", runId: o.runId, callId: call.id, name, label })
          const r = await this.deps.tools.execute(name, call.function.arguments, { projectId: o.projectId, sessionId: s.id, signal: o.signal })
          o.emit({ type: "tool_end", runId: o.runId, callId: call.id, name, label: r.label || label, ok: r.ok, summary: r.summary })
          push({ kind: "tool", name, label: r.label || label, ok: r.ok, summary: r.summary, at: now() })
          if (r.change) {
            proposals++
            push({ kind: "change", changeId: r.change.id, at: now() })
            o.emit({ type: "change", runId: o.runId, change: r.change })
          }
          msgs.push({ role: "tool", tool_call_id: call.id, content: r.content })
        }
        if (usage.promptTokens + usage.completionTokens > L.maxTokensPerRun) {
          status = "limit"
          message = "Lượt này đã dùng hết hạn mức token. Bạn có thể nhắn «tiếp tục»."
          break
        }
      }
    } catch (e) {
      const err = e as Error & { code?: string; status?: number }
      if (o.signal.aborted || err?.name === "AbortError") {
        status = "stopped"
        message = "Đã dừng theo yêu cầu."
      } else {
        status = "error"
        message =
          err instanceof LlmError
            ? err.status === 401 || err.code === "unauthorized" || err.code === "not_connected"
              ? "Ứng dụng cần kết nối lại với tài khoản."
              : err.message
            : (err as { code?: string }).code === "not_connected"
              ? "Ứng dụng chưa kết nối với tài khoản."
              : `Lỗi: ${err?.message ?? e}`
      }
    }

    if (message) {
      const level = status === "error" ? "error" : status === "done" ? "info" : "warn"
      push({ kind: "notice", level, text: message, at: now() })
      o.emit({ type: "notice", runId: o.runId, level, text: message })
    }
    // Bỏ lượt dở dang (assistant có tool_calls mà thiếu kết quả) để lần sau gửi không lỗi.
    while (msgs.length > 1) {
      const last = msgs[msgs.length - 1]
      if (last.role === "assistant" && last.tool_calls?.length) msgs.pop()
      else break
    }
    // Lưu bản rút gọn (kết quả công cụ cũ ngắn lại) để tệp phiên nhỏ.
    s.llm = compactMessages(msgs, L.contextChars, msgs.length, L.oldToolResultChars).messages.filter((m) => m.role !== "system").map((m) =>
      m.role === "tool" && m.content && m.content.length > 4000 ? { ...m, content: cut(m.content, 4000) } : m,
    )
    try {
      this.deps.sessions.save(o.projectId, s)
    } catch {
      /* ổ đầy… — không chặn kết thúc */
    }
    o.emit({ type: "run_end", runId: o.runId, projectId: o.projectId, sessionId: s.id, status, message, usage })
  }
}
