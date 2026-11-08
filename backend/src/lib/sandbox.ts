/**
 * Môi trường thực hành: công cụ nhúng mở trong slide của Học liệu (/embed/<alias>?sandbox=1) chạy dưới một danh tính
 * riêng do máy chủ suy ra, để thao tác của người học và giảng viên không chạm vào dữ liệu thật.
 *
 * Điểm chặn DUY NHẤT là sandboxGate(), đặt trước mọi route của backend. Lý do không xử lý ở proxy Next:
 * research.neu.edu.vn cho /api/* đi thẳng nginx → backend, còn ai.neu.edu.vn/research đi qua Next rồi mới tới backend;
 * cả hai đều hội tụ ở đây (Next chuyển tiếp nguyên header và Referer).
 *
 * Bất biến (backend/tests/sandbox.test.ts giữ):
 *  - Dấu hiệu sandbox chỉ HẠ quyền. Client gửi header giả chỉ tự đưa mình vào danh tính thực hành của chính mình.
 *  - Khi có dấu hiệu: xoá cookie phiên, ADMIN_SECRET, Authorization và mọi x-user-* trước khi chạy bất kỳ handler nào.
 *    App nhúng như Annota tự giải mã JWT từ cookie, nên chỉ ghi đè x-user-id là không đủ.
 *  - id là UUID v5 suy từ id thật (hoặc mã trình duyệt của Khách), client không chọn được; id thật là v4 nên không thể trùng.
 *  - Lệnh ghi không có đích an toàn thì bị từ chối (403), không bao giờ rơi về tài khoản thật.
 */
import crypto from "crypto"
import fs from "fs"
import path from "path"
import express, { NextFunction, Request, RequestHandler, Response } from "express"
import { getToken } from "next-auth/jwt"
import { GUEST_USER_ID, SYSTEM_USER_ID } from "./chat/constants"
import { query } from "./db"
import { parseCookies } from "./parse-cookies"
import { getBackendRoot } from "./paths"
import { getSetting } from "./settings"

/** Không đổi giá trị này: đổi là mọi người mất dữ liệu thực hành và sổ ai_portal.sandbox_users không còn khớp. */
export const SANDBOX_NAMESPACE = "6f3a1c2e-7b4d-5e90-a1c8-3d2f9b7e4a10"
export const SANDBOX_RETENTION_DAYS = 7
export const SANDBOX_DISPLAY_NAME = "Thực hành"
/** Reviewer và Plagiarism chuyển header qua fetch: ký tự ngoài Latin-1 như «ự» làm Headers.set ném lỗi và yêu cầu treo. */
export const SANDBOX_HEADER_NAME = "Thuc hanh"
export const SANDBOX_GUEST_COOKIE = "portal_sandbox_gid"
const GUEST_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30

const UUID_V4_OR_ANY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export interface SandboxIdentity {
  id: string
  email: string
  name: string
  isGuest: boolean
  /** Có đích lưu ổn định. Khách không có mã trình duyệt thì false: đọc được, ghi bị từ chối. */
  persistent: boolean
  realUserId: string | null
}

type SandboxRequest = Request & { portalSandbox?: SandboxIdentity }

export function getRequestSandbox(req: Request): SandboxIdentity | null {
  return (req as SandboxRequest).portalSandbox ?? null
}

// ───────────────────────── Suy ra danh tính ─────────────────────────

export function uuidv5(name: string, namespace: string = SANDBOX_NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex")
  const hash = crypto.createHash("sha1").update(ns).update(Buffer.from(name, "utf8")).digest()
  const b = Buffer.from(hash.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const deriveUserSandboxId = (realUserId: string): string => uuidv5(`user:${realUserId.toLowerCase()}`)
export const deriveGuestSandboxId = (browserCode: string): string => uuidv5(`guest:${browserCode.toLowerCase()}`)

/**
 * Khách dùng đuôi «@local» thay vì «@sandbox.local»: ExpertFinder và Regulations nhận biết khách bằng đuôi này để che
 * liên hệ chuyên gia và chặn AI; đuôi khác sẽ âm thầm nâng quyền cho người chưa đăng nhập.
 */
export function sandboxEmail(id: string, isGuest: boolean): string {
  return `sandbox-${id.slice(0, 8)}@${isGuest ? "local" : "sandbox.local"}`
}

function buildIdentity(id: string, isGuest: boolean, persistent: boolean, realUserId: string | null): SandboxIdentity {
  return { id, email: sandboxEmail(id, isGuest), name: SANDBOX_DISPLAY_NAME, isGuest, persistent, realUserId }
}

/** Tài khoản Khách dùng chung (JWT id 1111…) và các tài khoản guest-*: không coi là người đăng nhập. */
function isGuestSession(id: string, email: string | undefined): boolean {
  if (id === GUEST_USER_ID || id === SYSTEM_USER_ID) return true
  const e = String(email ?? "").trim().toLowerCase()
  return /^guest[-@]/.test(e) || e.endsWith("@portal.local") || e.endsWith("@local")
}

async function readRealSession(req: Request): Promise<{ id: string; email?: string } | null> {
  const secret = getSetting("NEXTAUTH_SECRET")
  if (!secret) return null
  const token = (await getToken({ req: { cookies: parseCookies(req.headers.cookie), headers: req.headers } as any, secret })) as
    | { id?: string; email?: string }
    | null
  return token?.id ? { id: token.id, email: token.email } : null
}

// ───────────────────────── Dấu hiệu ─────────────────────────

const EMBED_DOCUMENT_RE = /\/embed\/[^/]+\/?$/

function refererIsSandbox(req: Request): boolean {
  const raw = req.headers.referer
  if (!raw) return false
  try {
    // Không ràng buộc đường dẫn: router của Writium đổi URL trong khung về «/», script chỉ giữ được tham số sandbox.
    // Dấu hiệu này chỉ hạ quyền nên nhận rộng là an toàn.
    return new URL(raw).searchParams.get("sandbox") === "1"
  } catch {
    return false
  }
}

function isSandboxDocumentRequest(req: Request): boolean {
  return (req.method === "GET" || req.method === "HEAD") && EMBED_DOCUMENT_RE.test(req.path) && req.query?.sandbox === "1"
}

/** Header do script chèn vào đặt; Referer là dự phòng cho mọi thứ script không bọc được (điều hướng, form, sendBeacon). */
export function hasSandboxSignal(req: Request): boolean {
  return req.headers["x-portal-sandbox"] === "1" || refererIsSandbox(req) || isSandboxDocumentRequest(req)
}

// ───────────────────────── Sổ danh tính ─────────────────────────

export interface SandboxStore {
  ensure(identity: SandboxIdentity): Promise<void>
  surveyOwner(shortId: string): Promise<string | null>
}

let ledgerReady: Promise<void> | null = null
function ensureLedgerTable(): Promise<void> {
  if (!ledgerReady) {
    const sql = fs.readFileSync(path.join(getBackendRoot(), "migrations", "sandbox-users.sql"), "utf8")
    ledgerReady = query(sql).then(
      () => undefined,
      (e) => {
        ledgerReady = null
        throw e
      }
    )
  }
  return ledgerReady
}

const postgresStore: SandboxStore = {
  async ensure(identity) {
    await ensureLedgerTable()
    await query(
      `INSERT INTO ai_portal.sandbox_users (id, real_user_id, is_guest) VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (id) DO UPDATE SET last_seen = now()`,
      [identity.id, identity.realUserId, identity.isGuest]
    )
    // Khách không có dòng ai_portal.users. Annota mở vùng ghi âm phỏng vấn thật và GPU bóc băng cho mọi id có dòng ở đây,
    // nên tạo dòng cho khách là nâng quyền; không có dòng, Annota/Writium đối xử với họ như khách hiện tại.
    if (identity.isGuest) return
    const found = await query<{ email: string }>(`SELECT email FROM ai_portal.users WHERE id = $1::uuid`, [identity.id])
    if (found.rows[0]) {
      if (!/@sandbox\.local$/i.test(found.rows[0].email)) throw new Error("sandbox id collides with a real account")
      return
    }
    const insert = (email: string) =>
      query<{ id: string }>(
        `INSERT INTO ai_portal.users (id, email, display_name, full_name, role, is_admin, daily_message_limit, settings_json)
         VALUES ($1::uuid, $2, $3, $3, 'user', false, 0, '{"sandbox": true}'::jsonb)
         ON CONFLICT DO NOTHING RETURNING id`,
        [identity.id, email, SANDBOX_DISPLAY_NAME]
      )
    const first = await insert(identity.email)
    if (first.rows[0]) return
    // ON CONFLICT DO NOTHING không báo lý do: có thể phiên song song vừa tạo cùng id, hoặc trùng 8 ký tự email với id khác.
    const raced = await query(`SELECT 1 FROM ai_portal.users WHERE id = $1::uuid`, [identity.id])
    if (raced.rows[0]) return
    const second = await insert(`sandbox-${identity.id.replace(/-/g, "")}@sandbox.local`)
    if (!second.rows[0]) throw new Error("could not create sandbox user row")
  },
  async surveyOwner(shortId) {
    const r = await query<{ user_id: string | null }>(
      `SELECT s.user_id FROM surveylab.share_links l JOIN surveylab.surveys s ON s.id = l.survey_id WHERE l.short_id = $1 LIMIT 1`,
      [shortId]
    )
    return r.rows[0]?.user_id ?? null
  },
}

let store: SandboxStore = postgresStore
/** Chỉ dùng cho kiểm thử. Trả về hàm khôi phục. */
export function setSandboxStoreForTests(next: SandboxStore): () => void {
  store = next
  ensuredAt.clear()
  return () => {
    store = postgresStore
    ensuredAt.clear()
  }
}

const ENSURE_TTL_MS = 5 * 60 * 1000
const ensuredAt = new Map<string, number>()
async function ensureRecorded(identity: SandboxIdentity): Promise<void> {
  const at = ensuredAt.get(identity.id)
  if (at && Date.now() - at < ENSURE_TTL_MS) return
  await store.ensure(identity)
  if (ensuredAt.size > 20000) ensuredAt.clear()
  ensuredAt.set(identity.id, Date.now())
}

// ───────────────────────── Cổng toàn hệ thống ─────────────────────────

const CREDENTIAL_HEADERS = [
  "x-user-id",
  "x-user-email",
  "x-user-name",
  "x-user-is-admin",
  "x-proxy-user-id",
  "x-proxy-user-sig",
  "x-guest-id",
  "x-admin-secret",
  "authorization",
  "x-portal-sandbox",
]
const CREDENTIAL_COOKIE_RE = /^(?:__Secure-|__Host-)?next-auth\.|^admin_secret$/i

function stripRealCredentials(req: Request): void {
  for (const h of CREDENTIAL_HEADERS) delete req.headers[h]
  const raw = req.headers.cookie
  if (!raw) return
  const kept = raw
    .split(";")
    .map((p) => p.trim())
    .filter((p) => {
      const name = p.split("=", 1)[0]?.trim() ?? ""
      return p && !CREDENTIAL_COOKIE_RE.test(name) && name !== SANDBOX_GUEST_COOKIE
    })
  if (kept.length) req.headers.cookie = kept.join("; ")
  else delete req.headers.cookie
}

function setGuestCookie(req: Request, res: Response, code: string): void {
  const secure = req.headers["x-forwarded-proto"] === "https" || req.secure
  res.append(
    "Set-Cookie",
    `${SANDBOX_GUEST_COOKIE}=${code}; Path=/; Max-Age=${GUEST_COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
  )
}

async function resolveIdentity(req: Request, res: Response): Promise<SandboxIdentity> {
  const session = await readRealSession(req).catch(() => null)
  if (session && !isGuestSession(session.id, session.email)) {
    return buildIdentity(deriveUserSandboxId(session.id), false, true, session.id)
  }
  // Mã trình duyệt của Khách nằm trong cookie HttpOnly: máy chủ biết ngay khi dựng trang nên __PORTAL_USER__ đúng từ đầu,
  // và mọi yêu cầu (kể cả điều hướng, form) đều mang theo mà không phụ thuộc script.
  let code = parseCookies(req.headers.cookie)[SANDBOX_GUEST_COOKIE]
  if (code && UUID_V4_OR_ANY_RE.test(code)) return buildIdentity(deriveGuestSandboxId(code), true, true, null)
  if (isSandboxDocumentRequest(req)) {
    code = crypto.randomUUID()
    setGuestCookie(req, res, code)
    return buildIdentity(deriveGuestSandboxId(code), true, true, null)
  }
  return buildIdentity(deriveGuestSandboxId(crypto.randomUUID()), true, false, null)
}

/** Đường ghi ngoài /api/apps/* mà công cụ cần. Plagiarism tải tệp qua /api/upload; route đó ghi vào uploads/sandbox/<id>. */
const PORTAL_WRITE_ALLOWLIST = [/^\/api\/upload\/?$/]

function blockedJson(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: message, message, code })
}

export function sandboxGate(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!hasSandboxSignal(req)) return next()
    try {
      const identity = await resolveIdentity(req, res)
      ;(req as SandboxRequest).portalSandbox = identity
      stripRealCredentials(req)
      res.setHeader("x-portal-sandbox", "1")
      const write = !SAFE_METHODS.has(req.method.toUpperCase())
      if (write && !req.path.startsWith("/api/apps/")) {
        if (!PORTAL_WRITE_ALLOWLIST.some((re) => re.test(req.path))) {
          return blockedJson(res, 403, "SANDBOX_BLOCKED", "Thao tác này không dùng được trong môi trường thực hành.")
        }
        if (!identity.persistent) {
          return blockedJson(res, 403, "SANDBOX_NO_BROWSER_ID", "Trình duyệt chặn cookie nên môi trường thực hành không lưu được dữ liệu.")
        }
        await ensureRecorded(identity)
      }
      next()
    } catch (e: any) {
      // Không rơi về next(): phía sau là danh tính thật hoặc ẩn danh chưa được kiểm soát.
      console.error("[sandbox] gate failed:", e?.message)
      if (!res.headersSent) blockedJson(res, 503, "SANDBOX_UNAVAILABLE", "Môi trường thực hành tạm thời không sẵn sàng.")
    }
  }
}

// ───────────────────────── Chính sách từng công cụ ─────────────────────────

interface BlockRule {
  alias?: string
  methods?: RegExp
  path: RegExp
}

/** Đường ghi vẫn chạm dữ liệu thật dù đã đổi id. path so với đường dẫn tính từ app (sau /api/apps/<alias>). */
const BLOCK_RULES: BlockRule[] = [
  // Đăng nhập riêng của app (chế độ standalone còn trong bundle): không để tạo tài khoản hay phiên thật từ khung thực hành.
  { path: /\/auth\/(login|register|logout|sso)(\/|$)/i },
  // Nhận guest_id do client gửi rồi chuyển chủ bài viết: có thể kéo bài của tài khoản thật về id thực hành.
  { alias: "writium", methods: /^POST$/i, path: /\/write-articles\/merge-guest\/?$/i },
  // Sửa bài của người khác qua mã chia sẻ.
  { alias: "writium", methods: /^(POST|PUT|PATCH|DELETE)$/i, path: /\/write-articles\/shared\//i },
  // Thêm cộng tác viên làm bài thực hành hiện trong danh sách «được chia sẻ» của người thật.
  { alias: "writium", methods: /^(POST|PUT|PATCH|DELETE)$/i, path: /\/write-articles\/[^/]+\/collaborators(\/|$)/i },
]

const EMAIL_FIELD_NAMES = new Set(["email", "emails", "cc_emails", "cc", "bcc", "additional_notify_email", "notify_email", "user_profile", "user_url"])

export function stripEmailFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripEmailFields)
  if (!value || typeof value !== "object") return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!EMAIL_FIELD_NAMES.has(k.toLowerCase())) out[k] = stripEmailFields(v)
  }
  return out
}

/** Làm rỗng một trường văn bản trong thân multipart thô. Phần tệp nhị phân giữ nguyên từng byte. */
export function blankMultipartField(body: Buffer, contentType: string, field: string): Buffer {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType)
  if (!m) return body
  const boundary = Buffer.from(`--${m[1] || m[2]}`)
  const headerEnd = Buffer.from("\r\n\r\n")
  const nameRe = new RegExp(`content-disposition:[^\\r\\n]*[;\\s]name="${field}"(?:[;\\s]|$)`, "im")
  const out: Buffer[] = []
  let cursor = 0
  let at = body.indexOf(boundary)
  while (at !== -1) {
    const headersStart = at + boundary.length
    const headersEnd = body.indexOf(headerEnd, headersStart)
    if (headersEnd === -1) break
    const valueStart = headersEnd + headerEnd.length
    const nextBoundary = body.indexOf(boundary, valueStart)
    if (nextBoundary === -1) break
    if (nameRe.test(body.subarray(headersStart, headersEnd).toString("latin1"))) {
      out.push(body.subarray(cursor, valueStart))
      cursor = nextBoundary - 2 // giữ CRLF đứng trước boundary
    }
    at = nextBoundary
  }
  if (out.length === 0) return body
  out.push(body.subarray(cursor))
  return Buffer.concat(out)
}

const rawBody = express.raw({ type: () => true, limit: "50mb" })
function readRawBody(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => rawBody(req, res, (e?: unknown) => (e ? reject(e) : resolve())))
}

/**
 * Hai dịch vụ ngoài gửi thư theo địa chỉ người dùng gõ. Trong sandbox bỏ hết các trường địa chỉ.
 * Với Reviewer, không có email nghĩa là phản biện ngắn trả ngay, không chạy pipeline dài và không gửi thư.
 */
async function sanitizeOutboundMail(alias: string, req: Request, res: Response): Promise<boolean> {
  if (alias !== "paperreviewer" && alias !== "plagiarismchecker") return true
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true
  const contentType = String(req.headers["content-type"] ?? "")
  if (alias === "paperreviewer" && /\/v1\/upload\/?$/.test(req.path) && /multipart\/form-data/i.test(contentType)) {
    await readRawBody(req, res)
    if (Buffer.isBuffer(req.body)) req.body = blankMultipartField(req.body, contentType, "email")
    return true
  }
  // Bộ đọc JSON của server đặt req.body = {} cả khi không đọc gì (Content-Type khác); _body mới cho biết đã đọc thật.
  // Nếu chỉ xét req.body, thân text/plain sẽ lọt nguyên vẹn xuống express.raw của app.
  if ((req as Request & { _body?: boolean })._body && req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    const clean = stripEmailFields(req.body) as Record<string, unknown>
    // Giao diện Reviewer gửi địa chỉ gõ tay cả vào trường «user» (nhãn hiển thị).
    if ("user" in clean) clean.user = SANDBOX_HEADER_NAME
    req.body = clean
    return true
  }
  const hasBody = req.headers["transfer-encoding"] !== undefined || Number(req.headers["content-length"] ?? 0) > 0
  if (!hasBody) return true
  // Thân không phải JSON thì không bóc được trường địa chỉ, nên không chuyển đi.
  blockedJson(res, 415, "SANDBOX_BLOCKED", "Định dạng yêu cầu này không dùng được trong môi trường thực hành.")
  return false
}

/**
 * Gọi từ middleware của app nhúng, sau khi gán danh tính. Trả false nếu đã trả lời client.
 * Lệnh ghi thất bại ở bất kỳ bước nào đều bị từ chối, không đi tiếp.
 */
export async function enforceSandboxForApp(alias: string, req: Request, res: Response, identity: SandboxIdentity): Promise<boolean> {
  const method = req.method.toUpperCase()
  const write = !SAFE_METHODS.has(method)
  const relPath = req.path || "/"
  for (const rule of BLOCK_RULES) {
    if (rule.alias && rule.alias !== alias) continue
    if (rule.methods && !rule.methods.test(method)) continue
    if (rule.path.test(relPath)) {
      blockedJson(res, 403, "SANDBOX_BLOCKED", "Thao tác này không dùng được trong môi trường thực hành.")
      return false
    }
  }
  if (write && !identity.persistent) {
    blockedJson(res, 403, "SANDBOX_NO_BROWSER_ID", "Trình duyệt chặn cookie nên môi trường thực hành không lưu được dữ liệu.")
    return false
  }
  try {
    // Writium trả 401 ngay từ lệnh đọc nếu id chưa có trong ai_portal.users, nên người đăng nhập phải có dòng từ lần đọc đầu.
    if (write || !identity.isGuest) await ensureRecorded(identity)
    if (alias === "surveylab" && method === "POST") {
      const respond = /^\/api\/respond\/([^/]+)\/response\/?$/.exec(relPath)
      if (respond) {
        // Chỉ nhận trả lời vào khảo sát thực hành; link khảo sát thật không được nhận dữ liệu từ khung này.
        const owner = await store.surveyOwner(decodeURIComponent(respond[1]))
        if (owner && owner.charAt(14) !== "5") {
          blockedJson(res, 403, "SANDBOX_BLOCKED", "Không gửi được trả lời vào khảo sát thật từ môi trường thực hành.")
          return false
        }
      }
    }
    return await sanitizeOutboundMail(alias, req, res)
  } catch (e: any) {
    console.error("[sandbox] enforce failed:", alias, relPath, e?.message)
    if (write) {
      if (!res.headersSent) blockedJson(res, 503, "SANDBOX_UNAVAILABLE", "Môi trường thực hành tạm thời không sẵn sàng.")
      return false
    }
    return true
  }
}

// ───────────────────────── Script chèn vào trang ─────────────────────────

/**
 * Chạy trước mọi script của app. Quantis gọi thẳng backend trên máy 232 qua nginx, không đi qua backend này,
 * nên các đường ghi dùng chung của nó chỉ chặn được tại đây.
 */
export function renderSandboxBootstrap(identity: SandboxIdentity): string {
  const user = JSON.stringify({ id: identity.id, email: identity.email, name: identity.name, isAdmin: false })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
  const label = `Môi trường thực hành: dữ liệu ở đây tự xoá sau ${SANDBOX_RETENTION_DAYS} ngày`
  return `<script>(function(){
"use strict";
var USER=${user},ORIGIN=location.origin,HDR="x-portal-sandbox",BLOCK_MSG="Thao tác này không dùng được trong môi trường thực hành.";
var SHARED_WRITE=/\\/api\\/quantis\\/backend(?:-python)?\\/api\\/quantis\\/(?:settings|data|auth|sample-datasets)/i;
window.__PORTAL_SANDBOX__={active:true,user:USER,retentionDays:${SANDBOX_RETENTION_DAYS}};
window.__PORTAL_USER__=USER;
function same(u){try{return new URL(u,location.href).origin===ORIGIN}catch(e){return false}}
function deny(u,m){m=String(m||"GET").toUpperCase();if(m==="GET"||m==="HEAD"||m==="OPTIONS")return false;try{return SHARED_WRITE.test(new URL(u,location.href).pathname)}catch(e){return false}}
var F=window.fetch;
if(F){window.fetch=function(i,o){
var isReq=typeof Request!=="undefined"&&i instanceof Request;
var u=isReq?i.url:String(i&&i.href?i.href:i);
if(!same(u))return F.call(window,i,o);
if(deny(u,(o&&o.method)||(isReq?i.method:"GET")))return Promise.resolve(new Response(JSON.stringify({error:BLOCK_MSG,code:"SANDBOX_BLOCKED"}),{status:403,headers:{"content-type":"application/json"}}));
var h=new Headers((o&&o.headers)||(isReq?i.headers:void 0));h.set(HDR,"1");
var n={};if(o)for(var k in o)n[k]=o[k];n.headers=h;
return F.call(window,i,n)}}
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(m,u){
var a=Array.prototype.slice.call(arguments);
var s=same(u);
if(s&&deny(u,m))a[1]="/api/sandbox-blocked";
XO.apply(this,a);
if(s)this.setRequestHeader(HDR,"1")};
["pushState","replaceState"].forEach(function(f){var o=history[f];history[f]=function(st,t,u){
if(u!=null){try{var U=new URL(u,location.href);if(U.origin===ORIGIN&&U.searchParams.get("sandbox")!=="1"){U.searchParams.set("sandbox","1");u=U.pathname+U.search+U.hash}}catch(e){}}
return o.call(this,st,t,u)}});
function scope(name){
var real;try{real=window[name]}catch(e){return}
if(!real)return;
var P="__portal_sandbox__:";
function keys(){var a=[];for(var i=0;i<real.length;i++){var k=real.key(i);if(k&&k.indexOf(P)===0)a.push(k.slice(P.length))}return a}
var api={getItem:function(k){return real.getItem(P+k)},setItem:function(k,v){real.setItem(P+k,String(v))},removeItem:function(k){real.removeItem(P+k)},
clear:function(){keys().forEach(function(k){real.removeItem(P+k)})},key:function(i){var a=keys();return i<a.length?a[i]:null}};
var proxy=new Proxy(api,{
get:function(t,k){if(k==="length")return keys().length;if(typeof k!=="string")return void 0;if(k in t)return t[k];var v=real.getItem(P+k);return v===null?void 0:v},
set:function(t,k,v){real.setItem(P+String(k),String(v));return true},
has:function(t,k){return k==="length"||k in t||real.getItem(P+String(k))!==null},
deleteProperty:function(t,k){real.removeItem(P+String(k));return true},
ownKeys:function(){return keys()},
getOwnPropertyDescriptor:function(t,k){var v=real.getItem(P+String(k));return v===null?void 0:{value:v,writable:true,enumerable:true,configurable:true}}});
Object.defineProperty(window,name,{configurable:true,get:function(){return proxy}})}
scope("localStorage");scope("sessionStorage");
window.addEventListener("message",function(e){var d=e.data;if(!d||d.type!=="PORTAL_USER"||d.__sandbox)return;e.stopImmediatePropagation();
try{window.dispatchEvent(new MessageEvent("message",{data:{type:"PORTAL_USER",user:USER,__sandbox:true},origin:e.origin,source:e.source}))}catch(x){}},true);
function banner(){if(document.getElementById("__portal_sandbox_banner")||!document.body)return;var b=document.createElement("div");b.id="__portal_sandbox_banner";b.setAttribute("role","status");b.textContent=${JSON.stringify(label)};
b.style.cssText="position:fixed;left:8px;bottom:8px;z-index:2147483646;padding:3px 10px;border-radius:999px;background:rgba(146,64,14,.92);color:#fff;font:500 11px/1.5 system-ui,sans-serif;pointer-events:none;max-width:calc(100vw - 16px)";
document.body.appendChild(b)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",banner);else banner();
})();</script>`
}
