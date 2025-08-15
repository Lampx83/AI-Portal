import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
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
                accepted_file_types: ["pdf", "docx", "txt", "md"]
            },
            {
                model_id: "gpt-4o-mini",
                name: "GPT-4o Mini",
                description: "Mô hình nhanh, tiết kiệm chi phí",
                accepted_file_types: ["pdf", "txt"]
            }
        ],
        sample_prompts: [
            "Tóm tắt bài báo về học sâu trong y tế",
            "Giải thích khái niệm 'federated learning' trong AI",
            "Tìm các bài nghiên cứu về biến đổi khí hậu năm 2024"
        ],
        provided_data_types: [
            {
                type: "documents",
                description: "Danh sách và thông tin tóm tắt các tài liệu nghiên cứu mà Agent lưu trữ"
            },
            {
                type: "experts",
                description: "Danh sách chuyên gia liên quan tới lĩnh vực mà Agent quản lý"
            }
        ],
        contact: "email@example.com",
        status: "active"
    });
}
