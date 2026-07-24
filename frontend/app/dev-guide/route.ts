// Gated developer guide — fragment endpoint only.
// The standalone page was retired; all dev content now lives in /huong-dan.html#cho-dev,
// which lazy-loads this endpoint with ?embed=1. A direct hit (no ?embed) redirects there.
// Only users signed in with an NEU email (…@neu.edu.vn) may read the fragment.
// Mirrors the getToken() pattern used in middleware.ts / backend mounted-apps.ts.
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { DEV_FRAGMENT, buildGateFragment } from "./content"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** True only for NEU accounts: e.g. name@neu.edu.vn, name@st.neu.edu.vn, name@sub.neu.edu.vn */
function isNeuEmail(email?: string | null): boolean {
  if (!email) return false
  return /@([a-z0-9-]+\.)*neu\.edu\.vn$/i.test(email.trim().toLowerCase())
}

export async function GET(req: NextRequest) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")

  // Only ?embed=1 is served here (the injectable fragment for /huong-dan.html#cho-dev).
  // A direct visit to /dev-guide has no standalone page anymore → send it to the unified guide.
  // (Redirect first, before any token work — a direct hit never needs the auth check.)
  const embed = req.nextUrl.searchParams.get("embed") === "1"
  if (!embed) {
    return NextResponse.redirect(new URL(`${basePath}/huong-dan.html#cho-dev`, req.nextUrl.origin), 307)
  }

  const secureCookie = req.nextUrl.protocol === "https:"
  const secret = process.env.NEXTAUTH_SECRET || "change-me-in-admin"

  let email: string | undefined
  try {
    // Only decode a token if a session cookie is present (matches middleware perf guard).
    const hasSessionCookie = req.cookies
      .getAll()
      .some((c) => c.name.includes("next-auth.session-token") || c.name.includes("authjs.session-token"))
    if (hasSessionCookie) {
      const token = await getToken({ req, secret, secureCookie })
      email = (token as { email?: string } | null)?.email ?? undefined
    }
  } catch {
    email = undefined
  }

  if (!isNeuEmail(email)) {
    const loginUrl = `${basePath}/login?callbackUrl=${encodeURIComponent(`${basePath}/huong-dan.html?aud=dev`)}`
    return new NextResponse(buildGateFragment(loginUrl, !!email), {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
    })
  }

  return new NextResponse(DEV_FRAGMENT, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  })
}
