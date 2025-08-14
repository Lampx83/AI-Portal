import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        name: "Document Assistant Demo",
        description: "Tìm kiếm và tóm tắt tài liệu demo",
        version: "1.2.0",
        developer: "Nhóm Demo",
        capabilities: ["search", "summarize", "explain"],
        supported_models: [
            {
                model_id: "gpt-4",
                name: "GPT4o",
                description: "Sử dụng công nghệ của OpenAI"
            },
            {
                model_id: "qwen-3",
                name: "Qwen-3",
                description: "Tự host trên Server NEU"
            }
        ],
        sample_prompts: [
            "Tóm tắt tài liệu về AI",
            "Giải thích khái niệm machine learning"
        ],
        provided_data_types: [
            {
                type: "documents",
                description: "Danh sách tài liệu demo"
            }
        ],
        contact: "demo@example.com",
        status: "active"
    });
}
