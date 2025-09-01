// import { NextResponse } from "next/server";

// export async function GET(request: Request) {
//     try {
//         const apiRes = await fetch("http://101.96.66.218:8014/api/v1");
//         if (!apiRes.ok) {
//             return NextResponse.json({ error: "Failed to fetch data" }, { status: apiRes.status });
//         }
//         const data = await apiRes.json();
//         return NextResponse.json(data);
//     } catch (err) {
//         return NextResponse.json({ error: "Internal server error" }, { status: 500 });
//     }
// }

// pages/api/agents/experts.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    try {
        // Proxy mọi query params nếu có
        const query = new URLSearchParams(req.query as Record<string, string>).toString();

        const response = await fetch(`http://101.96.66.218:8014/api/v1/data?${query}`, {
            method: req.method,
            headers: {
                // Forward headers nếu cần
                "Content-Type": "application/json",
                // "Authorization": req.headers.authorization || "", // nếu API cần auth
            },
            body: req.method !== "GET" ? req.body : undefined,
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}
