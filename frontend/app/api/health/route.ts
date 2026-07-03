/**
 * Healthcheck siêu nhẹ cho container/watchdog: không gọi backend, không SSR.
 * Docker healthcheck cũ wget vào "/" — dưới basePath trả 404/redirect → luôn unhealthy.
 */
export const dynamic = "force-dynamic"

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "cache-control": "no-store", "content-type": "text/plain" },
  })
}
