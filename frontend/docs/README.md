# Agent API — AI-Portal

Implement your Agent following the standard below and register it in **Admin → Agents**. The Portal provides chat UI, embed, multi-language. For applications (apps): [APPLICATIONS.md](../../docs/APPLICATIONS.md). Overview: [DEVELOPERS.md](../../docs/DEVELOPERS.md) · [VISION.md](../../VISION.md).

---

## 1. Required endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `{base_url}/metadata` | GET | Declare name, description, capabilities, supported models. |
| `{base_url}/ask` | POST | Accept prompt + context, return Markdown content. |
| `{base_url}/data` | GET | Optional. Return data (documents, experts, …). |

Base URL: `https://your-server.com/v1` or `http://localhost:8000/v1`.

---

## 2. GET /metadata

JSON response, minimum:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Display name. |
| `description` | | Short description. |
| `capabilities` | | Array of strings (e.g. `["search","summarize"]`). |
| `supported_models` | | `[{ "model_id", "name", "accepted_file_types" }]` — `model_id` used in `/ask`. |
| `sample_prompts` | | Sample prompt suggestions. |
| `provided_data_types` | | For `/data?type=...` (e.g. `documents`, `experts`). |
| `status` | | `"active"` \| `"inactive"`. |

Example:

```json
{
  "name": "Document Assistant",
  "description": "Search and summarize documents",
  "capabilities": ["search", "summarize"],
  "supported_models": [
    { "model_id": "gpt-4o", "name": "GPT-4o", "accepted_file_types": ["pdf", "docx"] }
  ],
  "sample_prompts": ["Summarize an article about AI"],
  "status": "active"
}
```

---

## 3. POST /ask

**Request (JSON):**

| Field | Required | Description |
|-------|----------|-------------|
| `session_id` | ✅ | Session ID. |
| `model_id` | ✅ | Must be in `supported_models[].model_id`. |
| `user` | ✅ | User identifier or API URL. |
| `prompt` | ✅ | Question or request. |
| `output_type` | | Portal sends `"markdown"`. Agent should accept it and return content in that format (e.g. `content_markdown`). If your API validates output type, allow at least `"markdown"`. |
| `context.language` | | `vi`, `en`, … |
| `context.project` | | Project API URL — GET to fetch project info. |
| `context.extra_data.document` | | Array of attached file URLs. |
| `context.history` | | `[{ "role": "user"\|"assistant", "content": "..." }]`. |

**Response (JSON):** Portal expects **`status: "success"`** and at least one of: **`content_markdown`**, **`answer`**, **`content`** (priority in that order). Prefer **`content_markdown`** for rich display. Optional: `sources`, `attachments`, `meta.response_time_ms`.

Example request:

```json
{
  "session_id": "uuid",
  "model_id": "gpt-4o",
  "user": "https://portal.example.com/api/users/email/user@example.com",
  "prompt": "Summarize the document",
  "output_type": "markdown",
  "context": {
    "language": "en",
    "project": "https://portal.example.com/api/projects/{id}",
    "extra_data": { "document": ["https://.../file.pdf"] },
    "history": []
  }
}
```

Example response (agent **phải** trả về đúng format này thì Portal mới hiển thị được):

```json
{
  "session_id": "uuid",
  "status": "success",
  "content_markdown": "## Summary\nContent..."
}
```

- **Bắt buộc:** `status === "success"` và ít nhất một trong: `content_markdown`, `answer`, hoặc `content` (chuỗi nội dung trả lời).
- **Nên dùng:** `content_markdown` để hiển thị Markdown (heading, list, code, …).
- Nếu agent của bạn có tham số `output_type`: Portal gửi `output_type: "markdown"` — API agent cần chấp nhận giá trị `"markdown"` (không dùng `"text"` nếu API của bạn coi đó là invalid).

---

## 4. GET /data (optional)

`GET {base_url}/data?type=documents` (or `experts`, …). Response: `{ "status": "success", "data_type": "...", "items": [...] }`. Use when the Agent has data to list or suggest.

---

## 5. Registration & testing

**Registration:** Admin → **Agents** → Add: **alias** (e.g. `papers`), **base URL**, **icon**. You can add a **routing hint** so Central selects the right Agent when the user does not choose one.

**Test:**

```bash
curl -s {base_url}/metadata
curl -X POST {base_url}/ask -H "Content-Type: application/json" -d '{"session_id":"...","model_id":"gpt-4o","user":"...","prompt":"Hello"}'
```

Admin → Agents → select Agent → **Test API** to send a sample request.

---

## 6. System API (Portal sends in context)

- User: `GET /api/users/email/{email}` — Agent can call to get user profile.
- Project: `GET /api/projects/{id}` — Project info (name, description, team_members, file_keys).
- Chat history: `GET /api/chat/sessions/{session_id}/messages` — Message history.

---

## Checklist

- [ ] `GET /metadata` returns JSON in the correct format.
- [ ] `POST /ask` accepts payload, returns `content_markdown` (or `answer`/`content`).
- [ ] (Optional) `GET /data?type=...` if you have data.
- [ ] Handle `context.user`, `context.project`, `context.extra_data.document` if needed.
- [ ] Register in Admin → Agents and test.
