# Application standard (Applications)

Applications are registered in **Admin → Applications**. After adding (alias, base URL, icon), the app appears in the sidebar. The Portal provides the UI; developers focus on logic and **one required endpoint**.

---

## Requirements

**GET `{base_url}/metadata`** — JSON response:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Display name. |
| `description` | | Short description. |
| `version`, `developer`, `capabilities`, `status` | | Optional (same as Agent). |

Example:

```json
{
  "name": "My App",
  "description": "Document processing",
  "capabilities": ["upload", "export"],
  "status": "active"
}
```

The Portal calls `/metadata` to display the name and check status (healthy/unhealthy).

---

## Registration

1. Deploy a server with **GET {base_url}/metadata**.
2. Admin → **Applications** → Add: **alias**, **base_url**, **icon** (FileText | Database | Bot), **is_active**, **display_order**.
3. (Optional) **domain_url** if the app is a separate SPA; the Portal can open iframe/tab with this URL.

---

## Portal chạy với basePath (subpath)

Khi Portal triển khai không ở domain gốc mà có basePath (vd. `https://ai.neu.edu.vn/admission`):

1. **Portal (đã xử lý trong code):**
   - Frontend: iframe load app dùng `basePath + /embed/:alias` (vd. `/admission/embed/datium`).
   - Backend: khi serve HTML của app nhúng, inject `apiBase` và `baseHref` có prefix basePath (vd. `/admission/api/apps/datium`, `/admission/embed/datium/`).

2. **Cấu hình deploy:** Đặt cùng giá trị basePath cho cả frontend và backend:
   - Frontend: `NEXT_PUBLIC_BASE_PATH=/admission` (hoặc `BASE_PATH` tùy next.config).
   - Backend: `BASE_PATH=/admission` (hoặc trong Admin → Cài đặt: `PORTAL_PUBLIC_BASE_PATH`).

3. **Ứng dụng nhúng (vd. Datium):** Không cần sửa code nếu app **luôn dùng** biến Portal inject:
   - `window.__WRITE_API_BASE__` (hoặc `__DATA_API_BASE__`) cho mọi request API — Portal đã inject đường dẫn đúng (có basePath).  
   - Không hardcode `/api/apps/...` hay `/embed/...` trong app.

---

## Optional

- **ask / data:** If the app also participates in chat, implement `POST /ask` and `GET /data` per [Agent API](../frontend/docs/README.md).
- **Agent vs Application:** Agents (Admin → Agents) = chat assistants, Central orchestrates. Applications (Admin → Applications) = apps with UI; only `/metadata` is required to register.

Overview: [DEVELOPERS.md](DEVELOPERS.md) · [VISION.md](../VISION.md).
