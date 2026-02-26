# Developer guide — AI-Portal

AI operations platform: you deploy **Agents** or **Applications** following the API standard and register them in Admin. The Portal provides chat UI, embed, multi-language — no need to build the frontend.

---

## What do you want to do?

| Goal | Doc | Action |
|------|-----|--------|
| **Add Agent** (chat assistant) | [Agent API](../frontend/docs/README.md) | Implement `GET /metadata`, `POST /ask`; register in **Admin → Agents**. |
| **Add Application** (app with UI) | [Application standard](APPLICATIONS.md) | Implement `GET /metadata`; register in **Admin → Applications**. |
| **Understand architecture & vision** | [VISION](../VISION.md) | Overview, Agents, Central, Applications, Plugins. |

---

## Quick flow

1. **Agent:** Implement `{base_url}/metadata` (JSON: name, description, capabilities) and `{base_url}/ask` (POST, return `content_markdown`). → Admin → Agents: add alias + base URL.
2. **Application:** Implement `{base_url}/metadata` (JSON: name, description). → Admin → Applications: add alias + base URL.
3. **Central** (Main assistant) selects the right Agent when the user does not choose one; configure LLM at **Admin → Central**.

API details (ask payload, context, response): see [Agent API](../frontend/docs/README.md).
