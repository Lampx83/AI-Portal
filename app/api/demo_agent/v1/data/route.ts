// app/api/demo_agent/v1/data/route.ts
import { NextRequest, NextResponse } from "next/server"

const ALLOWED_ORIGIN = process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://research.neu.edu.vn"

const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    // Tùy chọn: cache preflight
    "Access-Control-Max-Age": "86400",
    // Nếu dùng cookie/session: bật credentials và KHÔNG dùng "*"
    // "Access-Control-Allow-Credentials": "true",
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: corsHeaders })
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
