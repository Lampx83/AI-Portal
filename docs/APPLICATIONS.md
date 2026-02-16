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

## Optional

- **ask / data:** If the app also participates in chat, implement `POST /ask` and `GET /data` per [Agent API](../frontend/docs/README.md).
- **Agent vs Application:** Agents (Admin → Agents) = chat assistants, Central orchestrates. Applications (Admin → Applications) = apps with UI; only `/metadata` is required to register.

Overview: [DEVELOPERS.md](DEVELOPERS.md) · [VISION.md](../VISION.md).
