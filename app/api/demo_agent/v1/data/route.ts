// app/api/demo_agent/v1/data/route.ts
import { NextRequest, NextResponse } from "next/server"

// Tùy chỉnh domain chính của hệ thống (prod)
const PRIMARY_DOMAIN = process.env.PRIMARY_DOMAIN ?? "research.neu.edu.vn"

// Whitelist tĩnh thêm (dev)
const EXTRA_WHITELIST = new Set<string>(["http://localhost:3000", "https://localhost:3000"])

/**
 * Kiểm tra xem origin có được phép hay không:
 * - Cùng domain (ví dụ https://research.neu.edu.vn) hoặc subdomain (*.research.neu.edu.vn)
 * - Nằm trong EXTRA_WHITELIST (localhost)
 */
function isAllowedOrigin(origin: string | null): boolean {
    if (!origin) return false
    try {
        const u = new URL(origin)
        // Cho phép đúng domain hoặc subdomain
        if (u.hostname === PRIMARY_DOMAIN || u.hostname.endsWith(`.${PRIMARY_DOMAIN}`)) return true
        // Cho phép whitelist thêm (localhost)
        if (EXTRA_WHITELIST.has(origin)) return true
        return false
    } catch {
        return false
    }
}

function corsHeaders(origin: string | null) {
    const allowed = isAllowedOrigin(origin) ? origin! : ""
    return {
        // LƯU Ý: Nếu cần gửi cookie, KHÔNG dùng "*", phải phản chiếu origin cụ thể
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        // Bật nếu cần kèm cookie/session qua CORS:
        // "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    }
}

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get("origin")
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(req: NextRequest) {
    const type = req.nextUrl.searchParams.get("type") || "documents"

    const demoData = {
        documents: [
            { id: "doc1", title: "AI in Education", summary: "Tổng quan ứng dụng AI trong giáo dục" },
            { id: "doc2", title: "Machine Learning Basics", summary: "Các khái niệm cơ bản" }
        ]
    }

    return NextResponse.json(
        {
            status: "success",
            data_type: type,
            items: (demoData as any)[type] || [],
            last_updated: new Date().toISOString(),
        },
        { headers: corsHeaders }
    )
}
