# Hướng dẫn nhà phát triển — AI-Portal

Nền tảng vận hành AI: bạn triển khai **Agent** hoặc **Ứng dụng** theo chuẩn API, đăng ký trong Admin. Portal cung cấp giao diện chat, embed, đa ngôn ngữ — không cần xây frontend.

---

## Bạn muốn làm gì?

| Mục tiêu | Tài liệu | Hành động |
|----------|----------|-----------|
| **Thêm Agent** (trợ lý chat) | [Agent API](../frontend/docs/README.md) | Triển khai `GET /metadata`, `POST /ask`; đăng ký **Admin → Agents**. |
| **Thêm Ứng dụng** (app có UI) | [Chuẩn ứng dụng](APPLICATIONS.md) | Triển khai `GET /metadata`; đăng ký **Admin → Applications**. |
| **Nắm kiến trúc & tầm nhìn** | [VISION](../VISION.md) | Overview, Agents, Central, Applications, Plugins. |

---

## Luồng nhanh

1. **Agent:** Implement `{base_url}/metadata` (JSON: name, description, capabilities) và `{base_url}/ask` (POST, trả `content_markdown`). → Admin → Agents: thêm alias + base URL.
2. **Ứng dụng:** Implement `{base_url}/metadata` (JSON: name, description). → Admin → Applications: thêm alias + base URL (+ domain_url nếu SPA riêng).
3. **Central** (Trợ lý chính) tự chọn Agent phù hợp khi người dùng không chọn; cấu hình LLM tại **Admin → Central**.

Chi tiết API (payload ask, context, response): xem [Agent API](../frontend/docs/README.md).
