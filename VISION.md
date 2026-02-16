# AI-Portal Vision

**AI-Portal** is an AI operations platform that enables developers and organizations to build enterprise AI applications **without building the UI themselves**. The Admin panel is built to **manage and control the entire system**. Language packs can be added easily via Admin → Settings.

---

## 1. Platform role

- **Central place to run AI systems**  
  A single deployment point: chat, virtual assistants, RAG, multi-Agent. Self-hosted on your infrastructure.

- **For developers**  
  Create **Agents** (API following the standard) or **Applications** (following the application standard), register them in the Portal. The Portal provides chat UI, embed, session and user management out of the box.

- **For enterprises / organizations**  
  Deploy once, manage users, projects, agents, applications, limits, feedback and operations through Admin.

---

## 2. Full system control (Admin)

The **Admin** page is the control center for the entire system. All configuration and operational data are managed here; no code changes are needed to change behavior.

### 2.1 Overview — See all information

- **System overview:** DB table stats, total rows, users (online, admin), Agents (enabled count), Projects, Write posts, Storage (object count, size), Qdrant (if plugin enabled).
- Charts: messages by day, by source (web/embed), by Agent; logins by day.
- Connection status: Database, Storage, Qdrant; list of Agents and healthy/unhealthy status.

**Purpose:** A single screen to see all operational information.

---

### 2.2 Agents — Manage Agents

- **Add / edit / delete Agent:** alias, base URL, icon, display order, config (embed, message/day limits, routing hints).
- **Export / Import** Agent configuration (JSON).
- **Embed:** get iframe code, configure domain whitelist, message/day limits for embed.
- **Conversations:** view session list (by agent, web/embed source), view messages (user anonymized).
- **Test:** test metadata, data, ask (text/file) for each Agent.

**Agent Central (Main assistant):**

- **Orchestration role:** When the user **does not select** a specific Agent, messages are sent to **Central**. Central uses an LLM (OpenAI / Gemini / Anthropic / OpenAI-compatible) to **choose the right Agent** from the registered Agents (and can call multiple Agents), then aggregates the response. Users only need to ask; the system selects the right Agent.
- Central config: **Admin → Central** (or Settings: Main assistant LLM): provider, model, API key, base URL. Central cannot be deleted; alias is always `central`.

---

### 2.3 Applications — Manage applications

- **Where applications are managed** (Write, Data and applications added later).
- Each application: **alias**, **base URL**, icon, enabled/disabled, display order, config (message/day limits, routing hints, embed).
- **Allows adding more applications** to the system: add a record in Admin → Applications, declare base URL (and optional domain URL if the app is a separate SPA). New applications must follow the **application development standard** (see section 4 and `docs/APPLICATIONS.md`).

**Application standard:** Applications provide a **GET {base_url}/metadata** endpoint returning metadata (name, description, capabilities, …) similar to Agents; the Portal uses metadata for display and connection checks. Applications can be a separate website (domain_url) or run via Portal proxy.

---

### 2.4 Plugins — Additional features

- **Plugins** extend the system to be **more powerful**, scalable to your needs.
- Example: **Qdrant plugin** — enable/disable Qdrant tab in Admin, configure Qdrant URL; used for RAG, vector DB, embedding.
- More plugins can be added (external Agent integration, webhook, reporting, …) following the Portal plugin standard.

---

### 2.5 Other Admin sections

- **Users** — Accounts, roles (user / admin / developer), message/day limits.
- **Projects** — User projects, members, files.
- **Limits** — Message limits by user, by agent, guest messages.
- **Feedback** — User feedback, message ratings.
- **Database** — View/edit tables (e.g. departments), run SQL.
- **Storage** — MinIO/S3, object management.
- **Qdrant** — Vector DB (when Qdrant plugin is enabled), RAG/embedding.
- **Settings** — Default language, Qdrant URL, environment variables (read-only), reset DB. **Language packs** can be added easily: download a sample pack, edit, upload to the system; supports multiple languages (vi, en, zh, hi, es and more).

---

## 3. Value for developers

| Need | AI-Portal provides |
|------|---------------------|
| Create new Agent | Deploy API (metadata, ask, data). Register in Admin → Agents. No frontend needed. |
| Add application to Portal | Follow application standard (metadata). Add in Admin → Applications. |
| User interface | Portal provides: chat, embed iframe, Write/Data apps, multi-language. |
| Orchestration when no Agent selected | Central selects the right Agent via LLM; admin configures LLM at Admin → Central. |
| Extend the system | Plugins (e.g. Qdrant); add languages via Settings. |

**Typical flow:** Developer deploys Agent or Application (API + metadata) → Registers in Admin (Agents or Applications) → End users use it via web/embed. When the user does not select an Agent, Central orchestrates and selects the right Agent.

---

## 4. Application development standard

To **add more applications** to the system (Admin → Applications), the application must:

1. **Base URL** — Application API address (e.g. `https://my-app.example.com/v1` or `http://localhost:3001/api/my_agent/v1`).
2. **Metadata endpoint** — **GET {base_url}/metadata** returns JSON with at least:
   - `name` (string): display name
   - `description` (string, optional): description
   - `capabilities` (array, optional)
   - Other fields per Agent standard (see `frontend/docs/README.md`).

The Portal calls `/metadata` to get name, description and check status (healthy/unhealthy). The application can be API-only (Portal embed or proxy) or a separate SPA (declare **domain_url** in Admin to open in iframe/tab).

Technical details and examples: see **`docs/APPLICATIONS.md`**.

---

## 5. Future direction

1. **Developer experience** — Clear docs (Agent + Application), code examples, Developer page in app; webhook/event on Agent errors or limit exceeded.
2. **Plugin standard** — Define how to package and enable/disable plugins (Qdrant as reference) for easier new plugins.
3. **Organization / multi-tenant (optional)** — Workspace/Organization, SSO/SAML.
4. **Operations & observability** — Latency dashboard, error rate, Agent down alerts.
5. **UI & language** — Continue improving multi-language, accessibility; add language packs via Settings.

---

## 6. Summary

- **AI-Portal** = self-hosted AI operations platform; Admin = manage and control the entire system.
- **Overview** = see all information (DB, users, agents, projects, storage, Qdrant, …).
- **Agents** = manage Agents; **Central** = orchestrates, selects the right Agent when the user does not choose one.
- **Applications** = manage applications; allows adding more applications via the **application development standard**.
- **Plugins** = additional features to make the system more powerful (e.g. Qdrant).
- **Language packs** = easily added via Admin → Settings.

**Developer docs (short):** [docs/DEVELOPERS.md](docs/DEVELOPERS.md) — table of contents. Agent API: `frontend/docs/README.md` and **/devs/docs** page. Application standard: [docs/APPLICATIONS.md](docs/APPLICATIONS.md).
