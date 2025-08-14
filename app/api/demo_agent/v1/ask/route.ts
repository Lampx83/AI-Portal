import { NextRequest, NextResponse } from "next/server";

interface AskRequest {
    session_id: string;
    user_id: string;
    model_id: string;
    prompt: string;
    context?: {
        language?: string;
        project_id?: string;
        extra_data?: any;
    };
}

export async function POST(req: NextRequest) {
    const body: AskRequest = await req.json();

    // Simple validation
    if (!body.session_id || !body.user_id || !body.model_id || !body.prompt) {
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

    // Fake processing
    const markdownContent = `## Kết quả tóm tắt\nBạn đã yêu cầu: **${body.prompt}**\n\n_Nội dung này là demo._`;

    return NextResponse.json({
        session_id: body.session_id,
        status: "success",
        content_markdown: markdownContent,
        meta: {
            model: body.model_id,
            response_time_ms: 120,
            tokens_used: 42
        },
        attachments: []
    });
}
