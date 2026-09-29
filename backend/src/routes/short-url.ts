// routes/short-url.ts — Rút gọn URL (dùng cho app QR Code để mã QR đơn giản hơn), public.
// POST /api/short { url } -> tạo mã ngắn. GET /api/short/:code -> chuyển hướng tới URL gốc.
import { Router, Request, Response } from "express"
import { getToken } from "next-auth/jwt"
import { query } from "../lib/db"
import { getSetting } from "../lib/settings"
import { parseCookies } from "../lib/parse-cookies"

const router = Router()

const CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ" // bỏ ký tự dễ nhầm (0/O, 1/l/I)
const CODE_LENGTH = 7
const MAX_RETRIES = 5

function randomCode(): string {
  let out = ""
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

async function getCurrentUserId(req: Request): Promise<string | null> {
  try {
    const secret = getSetting("NEXTAUTH_SECRET")
    if (!secret) return null
    const cookies = parseCookies(req.headers.cookie)
    const token = await getToken({ req: { cookies, headers: req.headers } as any, secret })
    return (token as { id?: string })?.id ?? null
  } catch {
    return null
  }
}

function normalizeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > 4000) return null
  try {
    const u = new URL(trimmed)
    if (u.protocol !== "http:" && u.protocol !== "https:") return null
    return u.toString()
  } catch {
    return null
  }
}

function buildOrigin(req: Request): string {
  return `${req.protocol}://${req.get("host")}`
}

/** POST /api/short — body: { url, source? } -> { code, shortUrl, targetUrl } */
router.post("/", async (req: Request, res: Response) => {
  try {
    const targetUrl = normalizeUrl((req.body ?? {}).url)
    if (!targetUrl) {
      return res.status(400).json({ error: "URL không hợp lệ (cần bắt đầu bằng http:// hoặc https://)" })
    }
    const source = typeof req.body?.source === "string" ? req.body.source.trim().slice(0, 50) : null
    const userId = await getCurrentUserId(req)
    const guestHeader = req.headers["x-guest-device-id"] ?? req.headers["x-guest-id"]
    const guestDeviceId =
      typeof guestHeader === "string" && guestHeader.trim() ? guestHeader.trim().slice(0, 100) : null

    let lastErr: unknown = null
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = randomCode()
      try {
        await query(
          `INSERT INTO ai_portal.short_urls (code, target_url, source, created_by, guest_device_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [code, targetUrl, source, userId, guestDeviceId]
        )
        const shortUrl = `${buildOrigin(req)}/api/short/${code}`
        return res.json({ code, shortUrl, targetUrl })
      } catch (e: any) {
        // unique_violation trên code -> thử mã khác
        if (e?.code === "23505") {
          lastErr = e
          continue
        }
        throw e
      }
    }
    throw lastErr || new Error("Không tạo được mã sau nhiều lần thử")
  } catch (err: any) {
    console.error("POST /api/short error:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

/** GET /api/short/:code — chuyển hướng tới URL gốc, ghi nhận lượt quét. */
router.get("/:code", async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code || "").slice(0, 50)
    if (!code) return res.status(404).send("Không tìm thấy liên kết")

    const result = await query<{ target_url: string }>(
      "SELECT target_url FROM ai_portal.short_urls WHERE code = $1",
      [code]
    )
    const targetUrl = result.rows[0]?.target_url
    if (!targetUrl) return res.status(404).send("Liên kết không tồn tại hoặc đã bị xoá")

    query(
      "UPDATE ai_portal.short_urls SET click_count = click_count + 1, last_clicked_at = now() WHERE code = $1",
      [code]
    ).catch((e) => console.warn("[short-url] failed to bump click_count:", e?.message))

    res.redirect(302, targetUrl)
  } catch (err: any) {
    console.error("GET /api/short/:code error:", err)
    res.status(500).send("Internal Server Error")
  }
})

export default router
