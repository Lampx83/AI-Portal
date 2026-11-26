// Backend giả tối thiểu để chạy frontend cục bộ khi kiểm thử thẻ «Thư mục trên máy»
// (không cần Postgres / tài khoản). Mọi API trả về rỗng; /api/setup/status báo đã cài đặt.
// Chạy: node test/fixtures/mock-backend.mjs [cổng=3901]  rồi  BACKEND_URL=http://localhost:3901 npm run dev (frontend)
import http from "node:http"

const port = Number(process.argv[2] || 3901)
http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://x")
    let body = {}
    if (url.pathname === "/api/setup/status") body = { needsSetup: false, guest_login_enabled: true }
    else if (url.pathname === "/api/site-strings/available-locales") body = { defaultLocale: "vi", publicLocales: ["vi", "en"] }
    else if (/\/(list|tools|assistants|projects|apps)\/?$/.test(url.pathname)) body = []
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  })
  .listen(port, "127.0.0.1", () => console.log(`mock backend http://127.0.0.1:${port}`))
