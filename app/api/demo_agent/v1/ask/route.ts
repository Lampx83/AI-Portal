import { NextRequest, NextResponse } from "next/server";

interface AskRequest {
    session_id: string;
    model_id: string;
    user: string; // URL của user
    prompt: string;
    context?: {
        project?: string; // URL của project
        extra_data?: any; // dữ liệu bổ sung (vd: document, dataset...)
    };
}

export async function POST(req: NextRequest) {
    const body: AskRequest = await req.json();

    // Simple validation
    if (!body.session_id || !body.model_id || !body.user || !body.prompt) {
        return NextResponse.json(
            {
                session_id: body.session_id || null,
                status: "error",
                error_code: "INVALID_REQUEST",
                error_message: "Thiếu tham số bắt buộc"
            },
            { status: 400 }
        );
    }

    const startTime = Date.now();

    // Fake processing — ở thực tế sẽ gọi LLM/Agent xử lý
    const markdownContent = `## Tóm tắt\nBạn đã yêu cầu: **${body.prompt}**\n\n_Nội dung này là demo._`;

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
        session_id: body.session_id,
        status: "success",
        content_markdown: markdownContent,
        meta: {
            model: body.model_id,
            response_time_ms: responseTime,
            tokens_used: 42 // giả lập
        },
        attachments: [
            {
                type: "pdf",
                url: "https://example.com/file.pdf"
            }
        ]
    });
}
