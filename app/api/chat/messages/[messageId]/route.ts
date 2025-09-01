// app/api/chat/messages/[messageId]/route.ts
import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(data: any, init?: number | ResponseInit) {
    return new NextResponse(JSON.stringify(data), {
        ...(typeof init === "number" ? { status: init } : init),
        headers: { "Content-Type": "application/json" },
    })
}

export async function GET(
    _req: Request,
    { params }: { params: { messageId: string } }
) {
    try {
        const sql = `
      SELECT
        m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ma.id,
              'file_name', ma.file_name,
              'file_type', ma.file_type,
              'file_size', ma.file_size,
              'storage_url', ma.storage_url
            )
          ) FILTER (WHERE ma.id IS NOT NULL),
          '[]'::json
        ) AS attachments
      FROM research_chat.messages m
      LEFT JOIN research_chat.message_attachments ma ON ma.message_id = m.id
      WHERE m.id = $1
      GROUP BY m.id
      LIMIT 1
    `
        const result = await query(sql, [params.messageId])
        if (!result.rowCount) return json({ error: "Not found" }, 404)
        return json({ data: result.rows[0] }, 200)
    } catch (e) {
        console.error(e)
        return json({ error: "Internal Server Error" }, 500)
    }
}
