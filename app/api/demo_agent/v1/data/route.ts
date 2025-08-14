import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const type = req.nextUrl.searchParams.get("type") || "documents";

    // Demo data
    const demoData = {
        documents: [
            { id: "doc1", title: "AI in Education", summary: "Tổng quan ứng dụng AI trong giáo dục" },
            { id: "doc2", title: "Machine Learning Basics", summary: "Các khái niệm cơ bản" }
        ]
    };

    return NextResponse.json({
        status: "success",
        data_type: type,
        items: demoData[type as keyof typeof demoData] || [],
        last_updated: new Date().toISOString()
    });
}
