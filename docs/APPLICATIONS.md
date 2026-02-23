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

## Portal running with basePath (subpath)

When the Portal is deployed not at the root domain but with a basePath (e.g. `https://ai.neu.edu.vn/admission`):

1. **Portal (handled in code):**
   - Frontend: iframe loads the app using `basePath + /embed/:alias` (e.g. `/admission/embed/datium`).
   - Backend: when serving the embedded app HTML, injects `apiBase`, `baseHref`, and `window.__PORTAL_BASE_PATH__` (with basePath prefix).
   - **When installing an app:** Backend writes `public/embed-config.json` into the app directory with `basePath` and `embedPath` (basePath from `BASE_PATH` or Admin → Settings `PORTAL_PUBLIC_BASE_PATH`). When serving the embed, the Portal uses this basePath for that app (rewrites HTML/JS/CSS).

2. **Deploy config:** Use the same basePath value for both frontend and backend:
   - Frontend: `NEXT_PUBLIC_BASE_PATH=/admission` (or `BASE_PATH` per next.config).
   - Backend: `BASE_PATH=/admission` (or in Admin → Settings: `PORTAL_PUBLIC_BASE_PATH`).

3. **Embedded apps (e.g. Datium):**
   - **basePath config:** Set **when the app is installed** (Portal writes `embed-config.json` and uses it when serving). The app can read `window.__PORTAL_BASE_PATH__` or fetch `embed-config.json` (basePath, embedPath) to build URLs when needed.
   - Use `window.__WRITE_API_BASE__` or `__DATA_API_BASE__` for all API requests — the Portal injects the correct paths.
   - Do not hardcode `/api/apps/...` or `/embed/...`. If a static build needs a base (e.g. Vite), use `EMBED_BASE_PATH=/admission/embed/datium` at build time; otherwise the Portal will rewrite file contents when serving.

---

## Optional

- **ask / data:** If the app also participates in chat, implement `POST /ask` and `GET /data` per [Agent API](../frontend/docs/README.md).
- **Agent vs Application:** Agents (Admin → Agents) = chat assistants, Central orchestrates. Applications (Admin → Applications) = apps with UI; only `/metadata` is required to register.

Overview: [DEVELOPERS.md](DEVELOPERS.md) · [VISION.md](../VISION.md).
