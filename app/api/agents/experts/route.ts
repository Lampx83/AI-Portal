import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const apiRes = await fetch("http://101.96.66.218:8014/api/v1/data?type=experts");
        if (!apiRes.ok) {
            return NextResponse.json({ error: "Failed to fetch data" }, { status: apiRes.status });
        }
        const data = await apiRes.json();
        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
