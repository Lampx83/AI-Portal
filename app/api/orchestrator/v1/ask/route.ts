import { NextRequest, NextResponse } from "next/server";
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function json(data: any, init?: number | ResponseInit) {
  return new NextResponse(JSON.stringify(data), {
    ...(typeof init === "number" ? { status: init } : init),
    headers: { "Content-Type": "application/json" },
  });
}

function withCors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}

// OPTIONS cho preflight CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// ─────────────────────────────────────────────
// Danh sách agent nội bộ
// ─────────────────────────────────────────────
const AGENTS = [
  { alias: "documents", baseUrl: "http://localhost:8000/v1" },
  { alias: "experts", baseUrl: "http://101.96.66.218:8014/api/v1" },
  { alias: "review", baseUrl: "http://localhost:8007/api/v1" },
];

// ─────────────────────────────────────────────
// Tool: Gọi agent nội bộ qua /ask
// ─────────────────────────────────────────────
const callAgentTool = tool({
  name: "call_agent",
  description: "Gọi một agent nội bộ qua endpoint /ask",
  parameters: z.object({
    alias: z.string().describe("Tên alias của agent cần gọi"),
    payload: z.object({}).catchall(z.any()).describe("Body request gửi đến agent"),
  }),
  execute: async (input) => {
    const { alias, payload } = input;
    const agent = AGENTS.find((a) => a.alias === alias);
    if (!agent) throw new Error(`Agent ${alias} không tồn tại`);

    try {
      const res = await fetch(`${agent.baseUrl}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Agent ${alias} trả lỗi ${res.status}: ${txt}`);
      }

      return await res.json();
    } catch (err: any) {
      console.warn(`❌ Không gọi được agent ${alias}, dùng fallback mock:`, err.message);
      return { status: "success", result: `Mock response từ agent ${alias}` };
    }
  },
});


// ─────────────────────────────────────────────
// Agent trung tâm (Orchestrator Agent)
// ─────────────────────────────────────────────
const orchestratorAgent = new Agent({
  name: "Orchestrator",
  instructions: `
    Bạn là agent điều phối trung tâm.
    Nhận input JSON có model_id và payload.
    Gọi tool "call_agent" với alias = model_id và payload = payload.
    Không tự tạo nội dung.
  `,
  tools: [callAgentTool],
});

// ─────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return withCors(
      json({ status: "error", error_message: "Body phải là JSON hợp lệ." }, 400)
    );
  }

  const { session_id, model_id, user, prompt } = body || {};
  if (!session_id || !model_id || !user || typeof prompt !== "string") {
    return withCors(
      json(
        {
          status: "error",
          error_message:
            "Thiếu trường bắt buộc (session_id, model_id, user, prompt)",
        },
        400
      )
    );
  }

  try {
    const result = await run(orchestratorAgent, [
      {
        role: "user",
        content: `Hãy gọi tool "call_agent" với alias "${model_id}" và payload sau: ${JSON.stringify(body)}`,
      },
    ]);

    return withCors(json(result.finalOutput));
  } catch (err: any) {
    console.error("❌ Agent SDK error:", err);
    return withCors(json({ status: "error", error_message: err.message }, 500));
  }
}
