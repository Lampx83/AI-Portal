// data/research-assisstants.ts
import type { AgentMetadata } from "@/lib/agent-types"
import type { LucideIcon } from "lucide-react"
import { Users, Database, ListTodo, ShieldCheck, Award, Newspaper, FileText } from "lucide-react"

export interface ResearchAssistant extends AgentMetadata {
    alias: string
    Icon: LucideIcon
    bgColor: string
    iconColor: string
    baseUrl?: string
}

export const researchAssistants: ResearchAssistant[] = [
    {
        alias: "main",
        name: "AI hỗ trợ nghiên cứu",
        description: "AI trung tâm điều phối các trợ lý: định tuyến yêu cầu, hợp nhất câu trả lời, fallback và ghi log.",
        version: "1.0.0",
        developer: "Nhóm Hệ thống tổng thể",
        capabilities: [
            "routing",
            "multi-agent-orchestration",
            "tool-selection",
            "answer-synthesis",
            "fallback",
            "logging",
            "rate-limit-aware",
            "cache"
        ],
        supported_models: [
            { model_id: "qwen-max", name: "Qwen-Max", description: "Mô hình mạnh mẽ, đa năng" },
            { model_id: "qwen-plus", name: "Qwen-Plus", description: "Hiệu năng cân bằng, tiết kiệm" },
            { model_id: "qwen-turbo", name: "Qwen-Turbo", description: "Tốc độ cao, tối ưu chi phí" }
        ],
        sample_prompts: [
            "Tôi cần tìm hội thảo phù hợp và gợi ý tạp chí, hãy tổng hợp giúp",
            "Hỏi chuyên gia phù hợp rồi tóm tắt 3 bài nghiên cứu liên quan",
            "Lấy dữ liệu khảo sát mới nhất, trực quan hóa và viết phần thảo luận",
            "Kiểm tra đạo văn bản thảo và gợi ý chỉnh sửa"
        ],
        contact: "kcntt@neu.edu.vn",
        status: "active",
        Icon: Users,
        bgColor: "bg-slate-100 dark:bg-slate-900/30",
        iconColor: "text-slate-700 dark:text-slate-300",
        baseUrl: "https://research.neu.edu.vn/api/orchestrator/v1"
    },
    {
        alias: "document",
        name: "Bài báo",
        description: "Tìm kiếm và tóm tắt tài liệu demo",
        version: "1.2.0",
        developer: "Nhóm Demo",
        capabilities: ["search", "summarize", "explain"],
        supported_models: [
            { model_id: "gpt-4", name: "GPT-4o", description: "Mô hình demo trả kết quả giả lập" },
            { model_id: "qwen-3", name: "qwen-3", description: "Mô hình demo trả kết quả giả lập" }
        ],
        sample_prompts: ["Tóm tắt tài liệu về AI", "Giải thích khái niệm machine learning"],
        provided_data_types: [{ type: "documents", description: "Danh sách tài liệu demo" }],
        contact: "demo@example.com",
        status: "active",
        Icon: FileText,
        bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
        iconColor: "text-cyan-600 dark:text-cyan-400",
        baseUrl: "https://research.neu.edu.vn/api/demo_agent/v1"
    },
    {
        "name": "Chuyên gia",
        alias: "experts",
        "description": "AI Assistant chuyên tìm kiếm và tư vấn về các chuyên gia, nhà nghiên cứu thuộc Trường Đại học Kinh tế Quốc dân (NEU)",
        "version": "1.0.0",
        "developer": "Nhóm phát triển NEU Research",
        "capabilities": [
            "expert_search",
            "intent_analysis",
            "contextual_response",
            "vietnamese_support",
            "academic_consultation"
        ],
        "supported_models": [
            {
                "model_id": "qwen-max",
                "name": "Qwen Max",
                "description": "Mô hình AI mạnh mẽ chuyên về tìm kiếm và tư vấn chuyên gia, hỗ trợ tiếng Việt tốt",
                "accepted_file_types": []
            }
        ],
        "sample_prompts": [
            "Tìm chuyên gia nghiên cứu về kinh tế vĩ mô",
            "Thông tin về chuyên gia Đặng Nguyên Anh",
            "Chuyên gia nghiên cứu về di dân và lao động",
            "Tìm nhà nghiên cứu trong lĩnh vực tài chính ngân hàng",
            "Chuyên gia về chính sách kinh tế xã hội",
            "Nghiên cứu về phát triển bền vững"
        ],
        "provided_data_types": [
            {
                "type": "experts",
                "description": "Danh sách chuyên gia và nhà nghiên cứu thuộc Trường Đại học Kinh tế Quốc dân (NEU)"
            }
        ],
        "contact": "kcntt@neu.edu.vn",
        "status": "active",
        Icon: Users,
        bgColor: "bg-violet-100 dark:bg-violet-900/30",
        iconColor: "text-violet-600 dark:text-violet-400",
        baseUrl: "https://research.neu.edu.vn/api/agents/experts"
    },
    {
        alias: "research",
        name: "Viết nghiên cứu",
        description: "Hỗ trợ hình thành ý tưởng, xây dựng câu hỏi nghiên cứu, phương pháp và khung nghiên cứu.",
        version: "1.0.0",
        supported_models: [{ model_id: "gpt-4o", name: "GPT-4o" }],
        sample_prompts: [
            "Đề xuất câu hỏi nghiên cứu cho chủ đề học tập thông minh",
            "Gợi ý khung PRISMA cho tổng quan hệ thống",
            "Soạn thảo đề cương nghiên cứu về AI trong giáo dục"
        ],
        capabilities: ["idea-generation", "planning", "writing"],
        Icon: FileText,
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400"
    },
    {
        alias: "data",
        name: "Dữ liệu",
        description: "Hỗ trợ truy xuất, phân tích và trực quan hóa dữ liệu nghiên cứu.",
        version: "1.0.0",
        supported_models: [{ model_id: "gpt-4o-mini", name: "GPT-4o Mini" }],
        sample_prompts: [
            "Trực quan hóa dữ liệu khảo sát sinh viên năm 2024",
            "Tính toán thống kê mô tả cho bộ dữ liệu tài chính này",
            "Vẽ biểu đồ xu hướng kinh tế từ dữ liệu NEU"
        ],
        capabilities: ["data-query", "analysis", "visualization"],
        Icon: Database,
        bgColor: "bg-green-100 dark:bg-green-900/30",
        iconColor: "text-green-600 dark:text-green-400"
    },
    {
        alias: "review",
        name: "Phản biện, kiểm tra",
        description: "Đánh giá, góp ý và gợi ý chỉnh sửa bài báo, luận văn, báo cáo.",
        version: "1.0.0",
        supported_models: [{ model_id: "gpt-4o-mini", name: "GPT-4o Mini" }],
        sample_prompts: [
            "Đánh giá điểm mạnh và hạn chế của bài báo này theo yêu cầu của hội thảo",
            "Phản biện luận văn dựa trên tiêu chí nội dung, phương pháp và hình thức",
            "Đưa ra góp ý cải thiện cho phần tổng quan nghiên cứu"
        ],
        capabilities: ["evaluation", "feedback", "suggestion"],
        Icon: ListTodo,
        bgColor: "bg-red-100 dark:bg-red-900/30",
        iconColor: "text-red-600 dark:text-red-400"
    },
    {
        alias: "publish",
        name: "Hội thảo, tạp chí",
        description:
            "Tổng hợp cơ hội công bố (hội thảo, tạp chí) uy tín trong nước và quốc tế phục vụ hoạt động NCKH của NEU.",
        version: "1.2.0",
        developer: "Nhóm thầy V Huy, V Minh, X Lâm",
        capabilities: ["search", "explain", "summarize"],
        supported_models: [
            { model_id: "qwen-max", name: "Qwen-Max", description: "Phù hợp cho tác vụ phức tạp" },
            { model_id: "qwen-plus", name: "Qwen-Plus", description: "Hiệu năng – chi phí cân bằng" },
            { model_id: "qwen-flash", name: "Qwen-Flash", description: "Nhanh, chi phí thấp" },
            { model_id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Reasoning mạnh" },
            { model_id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Nhanh, linh hoạt" },
            { model_id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", description: "Tối ưu chi phí" },
            { model_id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Tiết kiệm" }
        ],
        sample_prompts: [
            "Các hội thảo CNTT sắp tổ chức tại Trung Quốc?",
            "Danh sách tạp chí phù hợp với Kinh tế bền vững?",
            "05 tạp chí uy tín liên quan đến CNTT?"
        ],
        provided_data_types: [
            { type: "conferences", description: "Danh sách hội thảo lưu trữ bởi NEU Research Agent" },
            { type: "journals", description: "Danh sách tạp chí lưu trữ bởi NEU Research Agent" }
        ],
        contact: "kcntt@neu.edu.vn",
        status: "active",
        bgColor: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
        baseUrl: "https://publication.neuresearch.workers.dev/v1",
        Icon: Newspaper
    },
    {
        alias: "funds",
        name: "Quỹ nghiên cứu",
        description:
            "Tìm kiếm, hỏi đáp, tổng hợp các Quỹ tài trợ nghiên cứu phục vụ cán bộ, giảng viên, học viên NEU.",
        version: "1.2.0",
        developer: "Nhóm thầy V Huy, V Minh, X Lâm",
        capabilities: ["search", "explain", "summarize"],
        supported_models: [
            { model_id: "qwen-max", name: "Qwen-Max", description: "Phức tạp" },
            { model_id: "qwen-plus", name: "Qwen-Plus", description: "Cân bằng" },
            { model_id: "qwen-flash", name: "Qwen-Flash", description: "Nhanh, rẻ" },
            { model_id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Reasoning mạnh" },
            { model_id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Nhanh" },
            { model_id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", description: "Tối ưu chi phí" },
            { model_id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Tiết kiệm" }
        ],
        sample_prompts: [
            "Các quỹ tài trợ liên quan tới khoa học xã hội",
            "Danh sách quỹ tài trợ nghiên cứu",
            "Quỹ tài trợ cho dự án học máy"
        ],
        provided_data_types: [{ type: "funds", description: "Danh sách quỹ tài trợ lưu trữ" }],
        contact: "kcntt@neu.edu.vn",
        status: "active",
        bgColor: "bg-amber-100 dark:bg-amber-900/30",
        iconColor: "text-amber-600 dark:text-amber-400",
        Icon: Award,
        baseUrl: "https://fund.neuresearch.workers.dev/v1"
    },
    {
        alias: "plagiarism",
        name: "Kiểm tra đạo văn",
        description: "Phát hiện và báo cáo các nội dung trùng lặp hoặc đạo văn.",
        version: "1.0.0",
        supported_models: [{ model_id: "plagiarism-checker-v1", name: "Plagiarism Checker" }],
        sample_prompts: ["Kiểm tra đạo văn cho đoạn văn này", "So sánh nội dung với các nguồn mở"],
        capabilities: ["plagiarism-detection"],
        Icon: ShieldCheck,
        bgColor: "bg-red-100 dark:bg-red-900/30",
        iconColor: "text-red-600 dark:text-red-400"
    }
]
