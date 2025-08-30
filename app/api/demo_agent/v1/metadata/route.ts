// app/api/document-assistant/route.ts
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
    const origin = req.headers.get("origin")

    const body = {
        name: "Document Assistant",
        description: "Tìm kiếm, tóm tắt và giải thích tài liệu nghiên cứu",
        version: "1.2.0",
        developer: "Nhóm H Thắng, H Việt, X Lâm",
        capabilities: ["search", "summarize", "explain"],
        supported_models: [
            {
                model_id: "gpt-4o",
                name: "GPT-4o",
                description: "Mô hình mạnh cho tóm tắt và giải thích chi tiết",
                accepted_file_types: ["pdf", "docx", "txt", "md"],
            },
            {
                model_id: "gpt-4o-mini",
                name: "GPT-4o Mini",
                description: "Mô hình nhanh, tiết kiệm chi phí",
                accepted_file_types: ["pdf", "txt"],
            },
        ],
        sample_prompts: [
            "Tóm tắt bài báo về học sâu trong y tế",
            "Giải thích khái niệm 'federated learning' trong AI",
            "Tìm các bài nghiên cứu về biến đổi khí hậu năm 2024",
        ],
        provided_data_types: [
            {
                type: "documents",
                description: "Danh sách và thông tin tóm tắt các tài liệu nghiên cứu mà Agent lưu trữ",
            },
            {
                type: "experts",
                description: "Danh sách chuyên gia liên quan tới lĩnh vực mà Agent quản lý",
            },
        ],
        contact: "email@example.com",
        status: "active",
    }

    return NextResponse.json(body, { headers: corsHeaders(origin) })
}
