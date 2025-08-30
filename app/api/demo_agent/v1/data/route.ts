// app/api/demo_agent/v1/data/route.ts
import { NextRequest, NextResponse } from "next/server"

// Domain chính (prod)
const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN ?? "research.neu.edu.vn"

// Whitelist bổ sung (dev)
const EXTRA_WHITELIST = new Set<string>([
    "http://localhost:3000",
    "https://localhost:3000",
])

function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return false
    try {
        const u = new URL(origin)
        if (u.hostname === PRIMARY_DOMAIN || u.hostname.endsWith(`.${PRIMARY_DOMAIN}`)) return true
        if (EXTRA_WHITELIST.has(origin)) return true
        return false
    } catch {
        return false
    }
}

function buildCorsHeaders(origin: string | null) {
    const allowed = isAllowedOrigin(origin) ? origin! : ""
    const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    }
    // Chỉ set ACAO khi hợp lệ (tránh trả chuỗi rỗng)
    if (allowed) headers["Access-Control-Allow-Origin"] = allowed
    // Nếu cần cookie qua CORS:
    // headers["Access-Control-Allow-Credentials"] = "true"
    return headers
}

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get("origin")
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) })
}

export async function GET(req: NextRequest) {
    const origin = req.headers.get("origin")
    const headers = buildCorsHeaders(origin)

    const type = req.nextUrl.searchParams.get("type") || "documents"

    const demoData = {
        documents: [
            { id: "doc1", title: "AI in Education", summary: "Tổng quan ứng dụng AI trong giáo dục" },
            { id: "doc2", title: "Machine Learning Basics", summary: "Các khái niệm cơ bản" },
        ],
    }

    return NextResponse.json(
        {
            status: "success",
            data_type: type,
            items: (demoData as any)[type] || [],
            last_updated: new Date().toISOString(),
        },
        { headers } // 👈 truyền KẾT QUẢ headers
    )
}
