// Self-contained developer guide (Vietnamese) for the Research portal.
// Served ONLY to NEU accounts by ./route.ts. Contains NO secrets (keys, passwords,
// internal IPs/hostnames) — only field names, route paths and generic shapes.
//
// NOTE: DEV_GUIDE_HTML must not contain a backtick or the sequence dollar-brace,
// because it is stored in a template literal. All inline JS uses string concatenation.

export const DEV_GUIDE_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="Tài liệu kỹ thuật cho nhà phát triển hệ thống Research (NEU): tạo agent, memory/RAG, cá nhân hoá, dự án, file đính kèm, đóng gói công cụ và function-calling.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛠️</text></svg>">
<title>Research — Hướng dẫn cho nhà phát triển</title>
<style>
  :root{
    --bg:#FAFBFC;--surface:#FFFFFF;--surface-2:#F1F4F8;--border:#E3E8EF;--border-strong:#CFD8E3;
    --text:#1B2430;--text-muted:#5B6675;--brand:#1E5AA8;--brand-strong:#17427C;--brand-soft:#EAF1FA;
    --accent:#B9701B;--accent-soft:#FBF0DE;--good:#1F9D63;--good-soft:#E6F5EC;--bad:#D14343;--bad-soft:#FBEBEB;
    --warn:#B4820F;--warn-soft:#FBF3DC;--code-bg:#F4F7FA;
    --shadow:0 1px 2px rgba(23,40,64,.06),0 6px 24px rgba(23,40,64,.06);
    --font-sans:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    --font-mono:ui-monospace,"SF Mono","JetBrains Mono","Cascadia Code",Menlo,Consolas,monospace;
    --maxw:820px;--sidebar-w:296px;
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#0D1017;--surface:#141922;--surface-2:#1A2029;--border:#262E3A;--border-strong:#333D4B;
    --text:#E6E9EF;--text-muted:#97A1B0;--brand:#5B93D6;--brand-strong:#82AEE6;--brand-soft:#14243A;
    --accent:#E0A94A;--accent-soft:#2A2213;--good:#40C285;--good-soft:#10231A;--bad:#E27070;--bad-soft:#2A1518;
    --warn:#E0A94A;--warn-soft:#241C0C;--code-bg:#10151D;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}}
  :root[data-theme="light"]{--bg:#FAFBFC;--surface:#FFFFFF;--surface-2:#F1F4F8;--border:#E3E8EF;--border-strong:#CFD8E3;--text:#1B2430;--text-muted:#5B6675;--brand:#1E5AA8;--brand-strong:#17427C;--brand-soft:#EAF1FA;--accent:#B9701B;--accent-soft:#FBF0DE;--good:#1F9D63;--good-soft:#E6F5EC;--bad:#D14343;--bad-soft:#FBEBEB;--warn:#B4820F;--warn-soft:#FBF3DC;--code-bg:#F4F7FA;--shadow:0 1px 2px rgba(23,40,64,.06),0 6px 24px rgba(23,40,64,.06);}
  :root[data-theme="dark"]{--bg:#0D1017;--surface:#141922;--surface-2:#1A2029;--border:#262E3A;--border-strong:#333D4B;--text:#E6E9EF;--text-muted:#97A1B0;--brand:#5B93D6;--brand-strong:#82AEE6;--brand-soft:#14243A;--accent:#E0A94A;--accent-soft:#2A2213;--good:#40C285;--good-soft:#10231A;--bad:#E27070;--bad-soft:#2A1518;--warn:#E0A94A;--warn-soft:#241C0C;--code-bg:#10151D;--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 30px rgba(0,0,0,.35);}
  *{box-sizing:border-box}
  html{scroll-behavior:smooth;scroll-padding-top:84px}
  body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-sans);font-size:16px;line-height:1.65;-webkit-font-smoothing:antialiased}
  .progress{position:fixed;top:0;left:0;height:3px;width:0;z-index:60;background:linear-gradient(90deg,var(--brand),var(--accent));transition:width .1s linear}
  .topbar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:14px;height:60px;padding:0 20px;background:color-mix(in srgb,var(--surface) 88%,transparent);backdrop-filter:saturate(1.2) blur(10px);border-bottom:1px solid var(--border)}
  .brand{display:flex;align-items:center;gap:11px;font-weight:700;letter-spacing:-.01em}
  .brand .mark{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:linear-gradient(140deg,var(--brand),var(--brand-strong));color:#fff;font-size:15px;box-shadow:var(--shadow)}
  .brand .name{font-size:16px}
  .brand .tag{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);border-radius:999px;padding:2px 8px}
  .topbar .spacer{flex:1}
  .theme-btn,.menu-btn{display:grid;place-items:center;width:38px;height:38px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);cursor:pointer;font-size:16px}
  .menu-btn{display:none}
  .home-btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:9px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
  .home-btn:hover{border-color:var(--border-strong)}
  .scrim{display:none;position:fixed;inset:60px 0 0;background:rgba(10,14,20,.45);z-index:40}
  .shell{display:flex;align-items:flex-start;max-width:1280px;margin:0 auto}
  .sidebar{position:sticky;top:60px;align-self:flex-start;width:var(--sidebar-w);flex:0 0 var(--sidebar-w);height:calc(100vh - 60px);overflow-y:auto;padding:20px 14px 60px 22px;border-right:1px solid var(--border)}
  .sidebar h4{font-family:var(--font-mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:var(--text-muted);margin:20px 10px 8px;font-weight:600}
  .navgrp:first-of-type h4{margin-top:0}
  .sidebar a{display:block;padding:6px 10px;border-radius:7px;margin:1px 0;color:var(--text-muted);text-decoration:none;font-size:14px;line-height:1.4;border-left:2px solid transparent}
  .sidebar a:hover{background:var(--surface-2);color:var(--text)}
  .sidebar a.active{color:var(--brand-strong);background:var(--brand-soft);border-left-color:var(--brand);font-weight:600}
  main{flex:1 1 auto;min-width:0;padding:8px 40px 120px}
  .content{max-width:var(--maxw);margin:0 auto}
  .hero{padding:40px 0 30px;border-bottom:1px solid var(--border);margin-bottom:8px}
  .eyebrow{font-family:var(--font-mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:600;margin:0 0 14px}
  .hero h1{font-size:clamp(27px,5vw,38px);line-height:1.1;letter-spacing:-.025em;margin:0 0 14px;text-wrap:balance}
  .hero p.lead{font-size:17px;color:var(--text-muted);margin:0 0 4px;max-width:66ch}
  section{padding-top:34px}
  .sec-tag{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;padding:3px 10px;border-radius:999px;margin-bottom:14px;color:var(--brand-strong);background:var(--brand-soft)}
  .sec-tag.cap{color:var(--accent);background:var(--accent-soft)}
  .sec-tag.pkg{color:var(--good);background:var(--good-soft)}
  h2{font-size:26px;letter-spacing:-.02em;margin:6px 0 14px;line-height:1.2;text-wrap:balance}
  h3{font-size:18.5px;letter-spacing:-.01em;margin:30px 0 10px}
  h3 .n{font-family:var(--font-mono);font-size:13px;color:var(--accent);border:1px solid var(--border-strong);border-radius:6px;padding:1px 7px;margin-right:9px}
  h4{font-size:15.5px;margin:20px 0 8px}
  p{margin:0 0 14px}
  a.inline{color:var(--brand);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--brand) 35%,transparent)}
  a.inline:hover{border-bottom-color:var(--brand)}
  strong{font-weight:650}
  ul,ol{margin:0 0 16px;padding-left:22px}
  li{margin:6px 0}
  li::marker{color:var(--brand)}
  .divider{height:1px;background:var(--border);border:0;margin:44px 0}
  code:not(pre code){font-family:var(--font-mono);font-size:.86em;background:var(--code-bg);border:1px solid var(--border);border-radius:5px;padding:1px 5px;color:var(--accent);word-break:break-word}
  pre{margin:14px 0;padding:14px 16px;background:var(--code-bg);border:1px solid var(--border);border-radius:10px;overflow-x:auto;box-shadow:var(--shadow)}
  pre code{font-family:var(--font-mono);font-size:12.5px;line-height:1.6;color:var(--text);background:none;border:0;padding:0;white-space:pre}
  .pre-label{font-family:var(--font-mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin:16px 0 -6px}
  kbd{font-family:var(--font-mono);font-size:12.5px;line-height:1;background:var(--surface);border:1px solid var(--border-strong);border-bottom-width:2px;border-radius:6px;padding:3px 7px;color:var(--text);white-space:nowrap}
  .callout{display:flex;gap:12px;padding:14px 16px;border-radius:12px;margin:18px 0;border:1px solid var(--border);background:var(--surface-2);font-size:14.5px}
  .callout .ci{font-size:17px;line-height:1.5;flex:0 0 auto}
  .callout p{margin:0}
  .callout p+p{margin-top:6px}
  .callout.tip{background:var(--good-soft);border-color:color-mix(in srgb,var(--good) 32%,transparent)}
  .callout.warn{background:var(--warn-soft);border-color:color-mix(in srgb,var(--warn) 34%,transparent)}
  .callout.note{background:var(--brand-soft);border-color:color-mix(in srgb,var(--brand) 26%,transparent)}
  .callout.danger{background:var(--bad-soft);border-color:color-mix(in srgb,var(--bad) 34%,transparent)}
  .callout b.lbl{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:2px;font-family:var(--font-mono)}
  .table-wrap{overflow-x:auto;margin:18px 0;border:1px solid var(--border);border-radius:12px}
  table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:520px}
  thead th{text-align:left;background:var(--surface-2);color:var(--text);font-weight:650;font-size:12.5px;padding:10px 13px;border-bottom:1px solid var(--border)}
  tbody td{padding:10px 13px;border-bottom:1px solid var(--border);vertical-align:top}
  tbody td:first-child{white-space:nowrap;font-family:var(--font-mono);font-size:12.5px;color:var(--brand-strong)}
  tbody tr:last-child td{border-bottom:0}
  ol.steps{list-style:none;counter-reset:step;padding:0;margin:18px 0}
  ol.steps>li{counter-increment:step;position:relative;padding:2px 0 2px 46px;margin:0 0 16px}
  ol.steps>li::before{content:counter(step);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--brand-soft);color:var(--brand-strong);font-weight:700;font-size:14px;font-family:var(--font-mono);border:1px solid color-mix(in srgb,var(--brand) 25%,transparent)}
  ol.steps>li .st{font-weight:650;display:block;margin-bottom:2px}
  footer{max-width:var(--maxw);margin:56px auto 0;padding-top:22px;border-top:1px solid var(--border);color:var(--text-muted);font-size:13.5px}
  .backtop{position:fixed;right:22px;bottom:22px;z-index:45;width:42px;height:42px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--brand);font-size:17px;cursor:pointer;box-shadow:var(--shadow);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .25s,transform .25s}
  .backtop.show{opacity:1;pointer-events:auto;transform:none}
  @media (max-width:960px){
    .menu-btn{display:grid}
    .sidebar{position:fixed;top:60px;left:0;z-index:45;width:300px;flex-basis:300px;background:var(--surface);transform:translateX(-102%);transition:transform .22s;box-shadow:var(--shadow)}
    body.nav-open .sidebar{transform:translateX(0)}
    body.nav-open .scrim{display:block}
    main{padding:8px 22px 100px}
  }
  @media print{.topbar,.sidebar,.scrim,.backtop,.progress{display:none!important}.shell{display:block}main{padding:0}.content{max-width:none}pre,table,.callout{break-inside:avoid}}
</style>
</head>
<body>
<div class="progress" id="progress"></div>
<div class="topbar">
  <button class="menu-btn" id="menuBtn" aria-label="Mở mục lục">☰</button>
  <div class="brand"><span class="mark">🛠️</span><span class="name">Research</span><span class="tag">Developer</span></div>
  <span class="spacer"></span>
  <a class="home-btn" href="huong-dan.html">← Hướng dẫn người dùng</a>
  <button class="theme-btn" id="themeBtn" aria-label="Đổi giao diện">◐</button>
</div>
<div class="scrim" id="scrim"></div>
<div class="shell">
  <nav class="sidebar" id="sidebar">
    <div class="navgrp">
      <h4>Bắt đầu</h4>
      <a href="#tong-quan">Tổng quan &amp; kiến trúc</a>
    </div>
    <div class="navgrp">
      <h4>Năng lực nền tảng</h4>
      <a href="#tao-agent">Tạo Agent / Trợ lý</a>
      <a href="#memory">Memory &amp; Knowledge (RAG)</a>
      <a href="#ca-nhan-hoa">Cá nhân hoá</a>
      <a href="#project">Dự án (Project)</a>
      <a href="#file">File đính kèm</a>
    </div>
    <div class="navgrp">
      <h4>Công cụ (Tool App)</h4>
      <a href="#goi-app">Đóng gói ứng dụng</a>
      <a href="#nhung">Nhúng &amp; runtime</a>
      <a href="#functions">Function-calling</a>
      <a href="#local-dev">Phát triển cục bộ</a>
    </div>
    <div class="navgrp">
      <h4>Khác</h4>
      <a href="#routing">Định tuyến mô hình</a>
      <a href="#admin-dev">Bề mặt Admin/Dev</a>
      <a href="#checklist">Checklist</a>
      <a href="#bao-mat">Bảo mật &amp; lưu ý</a>
    </div>
  </nav>
  <main>
    <div class="content">

      <header class="hero">
        <p class="eyebrow">Tài liệu kỹ thuật · Nội bộ NEU</p>
        <h1>Research — Hướng dẫn cho nhà phát triển</h1>
        <p class="lead">Cách mở rộng nền tảng Research: đăng ký <strong>agent</strong> riêng, gắn <strong>tri thức (RAG)</strong>, tận dụng <strong>cá nhân hoá</strong> theo hồ sơ, làm việc với <strong>dự án</strong> và <strong>file đính kèm</strong>, cùng cách <strong>đóng gói công cụ</strong> và tích hợp <strong>function-calling</strong> với Trợ lý chính.</p>
      </header>

      <div class="callout danger">
        <span class="ci">🔒</span>
        <p><b class="lbl">Tài liệu nội bộ — không chứa bí mật</b>Trang này chỉ mở cho tài khoản <code>@neu.edu.vn</code>. Tài liệu <strong>không</strong> nêu API key, mật khẩu, <code>NEXTAUTH_SECRET</code>, khóa MinIO hay địa chỉ IP/host nội bộ. Khi bạn viết cấu hình thật, đặt bí mật trong biến môi trường / bảng cài đặt, <strong>không hardcode</strong> và không đưa vào tài liệu công khai.</p>
      </div>

      <!-- TỔNG QUAN -->
      <section id="tong-quan">
        <span class="sec-tag">● Bắt đầu</span>
        <h2>Tổng quan &amp; kiến trúc</h2>
        <p>Nền tảng gồm <strong>frontend Next.js</strong> và <strong>backend Node/Express</strong>, cùng cơ sở dữ liệu PostgreSQL (schema <code>ai_portal</code>) và lưu trữ đối tượng (MinIO/S3). Có ba loại “thành phần” mà nhà phát triển có thể tạo/tích hợp:</p>
        <ul>
          <li><strong>Agent chuyên biệt</strong> — một microservice độc lập bạn tự chạy, expose ba endpoint theo hợp đồng chung (<code>/metadata</code>, <code>/data</code>, <code>/ask</code>). Portal chỉ lưu thông tin <em>đăng ký &amp; định tuyến</em> (alias, <code>base_url</code>, icon…), không lưu prompt/model/khóa của agent.</li>
          <li><strong>Trợ lý trung tâm (Central)</strong> — chạy nội bộ trong backend, là bộ điều phối (orchestrator). Đây là agent duy nhất Portal tự cấu hình LLM.</li>
          <li><strong>Tool App (công cụ)</strong> — ứng dụng Vite/React đóng gói <code>.zip</code> rồi cài vào Portal, nhúng qua iframe tại <code>/embed/&lt;alias&gt;</code>; có thể khai báo <code>functions</code> để Trợ lý chính gọi.</li>
        </ul>
        <p>Ba điểm một thành phần có thể chạm tới Portal: (1) <strong>nhúng UI</strong> qua iframe; (2) <strong>gọi API</strong> qua proxy <code>/api/apps/&lt;alias&gt;</code>; (3) <strong>được Trợ lý chính điều phối/gọi hàm</strong>.</p>
        <div class="callout note"><span class="ci">🧭</span><p><b class="lbl">Chọn hướng nào?</b>Cần một <em>trợ lý hội thoại</em> có tri thức/logic riêng → làm <strong>Agent chuyên biệt</strong>. Cần một <em>ứng dụng có giao diện</em> (bảng biểu, form, phân tích) → làm <strong>Tool App</strong>. Hai hướng có thể kết hợp.</p></div>
      </section>

      <hr class="divider">

      <!-- TẠO AGENT -->
      <section id="tao-agent">
        <span class="sec-tag cap">◆ Năng lực</span>
        <h2>Tạo Agent / Trợ lý</h2>
        <p>Một <strong>agent chuyên biệt</strong> là microservice của bạn. “Tính cách” của agent (tên, mô tả, model hỗ trợ, câu gợi ý, capabilities, loại dữ liệu cung cấp) do <strong>chính agent trả về</strong> qua <code>/metadata</code> — Portal không lưu các thứ này. Đăng ký agent = trỏ <code>base_url</code> tới service đã chạy đúng hợp đồng.</p>

        <h3><span class="n">1</span> Hợp đồng ba endpoint của agent</h3>
        <p>Agent của bạn phải phục vụ (đường dẫn tương đối theo <code>base_url</code>):</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Endpoint</th><th>Vai trò</th></tr></thead>
          <tbody>
            <tr><td>GET /metadata</td><td>Khai báo danh tính &amp; khả năng agent (xem shape dưới).</td></tr>
            <tr><td>GET /data?type=…</td><td>(Tuỳ chọn) Trả dữ liệu theo <code>provided_data_types</code> để hiển thị tab “Xem dữ liệu”.</td></tr>
            <tr><td>POST /ask</td><td>Nhận câu hỏi + <code>context</code> và trả lời (hỗ trợ SSE streaming).</td></tr>
          </tbody>
        </table></div>
        <p class="pre-label">GET /metadata — shape trả về</p>
        <pre><code>{
  "name": "Chuyên gia",
  "description": "Trợ lý tìm kiếm chuyên gia...",
  "version": "1.0.0",
  "developer": "Khoa/Đơn vị",
  "capabilities": ["search", "summarize"],
  "supported_models": [
    { "model_id": "gpt-4o-mini", "name": "GPT-4o mini",
      "description": "...",
      "accepted_file_types": ["pdf","docx","xlsx","xls","txt","md","csv"] }
  ],
  "sample_prompts": ["Tìm chuyên gia về Machine Learning"],
  "provided_data_types": [
    { "type": "experts", "description": "Danh sách chuyên gia" }
  ]
}</code></pre>
        <p class="pre-label">POST /ask — body Portal gửi tới agent</p>
        <pre><code>{
  "message": "câu hỏi của người dùng",
  "model": "gpt-4o-mini",
  "context": {
    "history": [ { "role": "user|assistant", "content": "..." } ],
    "user_profile": { "email": "...", "full_name": "...", "..." : "..." },
    "project_info": { "name": "...", "description": "..." },
    "extra_data": { "document": [ { "url": "...", "name": "...", "text": "..." } ] }
  }
}</code></pre>
        <div class="callout tip"><span class="ci">💡</span><p><b class="lbl">Agent ngoài nhận sẵn ngữ cảnh</b>Portal <strong>làm giàu</strong> body <code>/ask</code>: đã kèm <code>context.user_profile</code>, <code>context.project_info</code> và <code>document[].text</code> (nội dung file đã trích) — agent của bạn không cần tự tải/parse hay gọi API nội bộ Portal.</p></div>

        <h3><span class="n">2</span> Đăng ký agent vào Portal</h3>
        <p>Bảng <code>ai_portal.assistants</code> lưu thông tin đăng ký. Tạo qua tab Admin <strong>“Trợ lý”</strong> hoặc API (<code>adminOnly</code>):</p>
        <p class="pre-label">POST /api/admin/agents</p>
        <pre><code>{
  "alias": "expert",                 // định danh kỹ thuật, duy nhất
  "base_url": "https://your-agent.example/api/v1",
  "icon": "Users",                   // tên icon (Lucide)
  "display_order": 5,
  "pinned": true,
  "config_json": {
    "displayName": "Tìm chuyên gia",
    "routing_hint": "chuyên gia, expert, người hướng dẫn",
    "daily_message_limit": 100,
    "embed_allow_all": false,
    "embed_allowed_domains": ["example.edu.vn"]
  }
}</code></pre>
        <p>Các route quản trị khác: <code>GET/PATCH/DELETE /api/admin/agents/:id</code>, <code>DELETE …/:id/permanent</code>, <code>GET …/export</code> · <code>POST …/import</code> (upsert theo <code>alias</code>), và kiểm thử <code>POST …/test</code> · <code>…/test-all-stream</code> (gọi thử <code>/metadata·/data·/ask</code>, lưu kết quả vào <code>agent_test_runs/agent_test_results</code>).</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Cột / field</th><th>Ý nghĩa</th></tr></thead>
          <tbody>
            <tr><td>alias</td><td>Định danh duy nhất; không đổi được alias của <code>central</code>.</td></tr>
            <tr><td>base_url</td><td>URL gốc microservice agent.</td></tr>
            <tr><td>icon</td><td>Tên icon hiển thị (mặc định <code>Bot</code>).</td></tr>
            <tr><td>is_active</td><td>Bật/tắt; xóa mềm = <code>false</code>.</td></tr>
            <tr><td>display_order / pinned</td><td>Thứ tự &amp; ghim sidebar.</td></tr>
            <tr><td>config_json.displayName</td><td>Tên hiển thị (ghi đè <code>name</code> từ metadata).</td></tr>
            <tr><td>config_json.routing_hint</td><td>Từ khóa giúp orchestrator định tuyến tới agent.</td></tr>
            <tr><td>config_json.daily_message_limit</td><td>Giới hạn tin/ngày (mặc định 100).</td></tr>
            <tr><td>config_json.embed_*</td><td>Cấu hình nhúng iframe (allow_all / allowed_domains / daily_limit).</td></tr>
          </tbody>
        </table></div>

        <h3><span class="n">3</span> Trợ lý trung tâm (Central) — cấu hình khác biệt</h3>
        <p>Central chạy nội bộ; cấu hình lưu ở bảng key–value <code>ai_portal.app_settings</code>, chỉnh trong tab Admin <strong>“Central”</strong>. Các khóa chính:</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Khóa app_settings</th><th>Ý nghĩa</th></tr></thead>
          <tbody>
            <tr><td>central_llm_provider</td><td><code>openai · gemini · anthropic · openai_compatible · ollama · skip</code></td></tr>
            <tr><td>central_llm_model</td><td>Model (vd <code>gpt-4o-mini</code>, <code>qwen3:8b</code>).</td></tr>
            <tr><td>central_llm_api_key</td><td>Khóa LLM — <strong>bí mật</strong> (<code>&lt;YOUR_KEY&gt;</code>); GET trả về đã che <code>••••</code>.</td></tr>
            <tr><td>central_llm_base_url</td><td>Base URL cho <code>openai_compatible</code>/<code>ollama</code> (không đưa host nội bộ vào tài liệu).</td></tr>
            <tr><td>central_system_prompt</td><td>System prompt (rỗng → dùng mặc định trong code).</td></tr>
            <tr><td>central_routing_enabled</td><td><code>true</code>: Central định tuyến sang agent chuyên biệt; <code>false</code>: tự trả lời.</td></tr>
          </tbody>
        </table></div>
        <p>Runtime: <code>/api/central_agent/v1/ask</code> proxy sang <code>/api/orchestrator/v1/ask</code>. Orchestrator dùng <code>getAgentsForOrchestrator()</code> (gộp agents + tools kèm <code>routing_hint</code>) để LLM chọn nơi trả lời, rồi forward. Metadata agent được cache ~5 phút.</p>
      </section>

      <hr class="divider">

      <!-- MEMORY -->
      <section id="memory">
        <span class="sec-tag cap">◆ Năng lực</span>
        <h2>Memory &amp; Knowledge (RAG)</h2>
        <p>Cần phân biệt rõ để không kỳ vọng sai:</p>
        <ul>
          <li><strong>Bộ nhớ hội thoại (ngắn hạn):</strong> mỗi lượt chat, backend lấy <strong>~10 lượt gần nhất</strong> của phiên (<code>getRecentTurns(sessionId, 10)</code> từ bảng <code>ai_portal.messages</code>) và đưa vào <code>context.history</code>. Orchestrator còn cắt bớt (<code>clippedHistory</code>) để vừa cửa sổ ngữ cảnh.</li>
          <li><strong>Không có “long-term memory” tự học</strong> theo người dùng/agent ở lõi hệ thống — nếu cần, agent của bạn tự quản trạng thái.</li>
          <li><strong>RAG bằng vector (Qdrant):</strong> có hạ tầng, dùng chủ yếu ở Admin cho kho tri thức quy chế. Luồng chat trung tâm <strong>không</strong> tự động chèn kết quả Qdrant; việc truy hồi vector thường do <strong>agent chuyên biệt</strong> tự làm.</li>
        </ul>
        <h3><span class="n">1</span> Qdrant client &amp; cấu hình</h3>
        <p>Client <code>backend/src/lib/qdrant.ts</code>: <code>searchPoints(collection, vector, {limit, scoreThreshold})</code>, <code>scrollPoints(collection, {limit, offset})</code>. Cấu hình qua cài đặt (không nêu host thật): <code>QDRANT_URL</code>, <code>REGULATIONS_EMBEDDING_URL</code>, <code>REGULATIONS_EMBEDDING_MODEL</code> (mặc định <code>text-embedding-3-small</code>). Qdrant chỉ hoạt động khi <strong>plugin Qdrant</strong> được bật.</p>
        <h3><span class="n">2</span> Ingest / retrieve (Admin “Qdrant”)</h3>
        <p>Route <code>/api/admin/qdrant/*</code> (<code>adminOnly</code>): <code>GET /health</code>, <code>GET /collections</code>, <code>POST /collections/:name/scroll</code>, và <code>POST /search</code> với body <code>{ collection, keyword, limit }</code> → tạo embedding cho <code>keyword</code> rồi <code>searchPoints</code>.</p>
        <p class="pre-label">POST /api/admin/qdrant/search — kết quả</p>
        <pre><code>{
  "keyword": "quy chế đào tạo",
  "collection": "regulations",
  "points": [
    { "id": 123, "score": 0.82, "payload": { "text": "...", "source": "..." } }
  ]
}</code></pre>
        <h3><span class="n">3</span> Cho agent “có kiến thức”</h3>
        <p>Cách khuyến nghị: trong endpoint <code>/ask</code> của agent chuyên biệt, tự nhúng tài liệu → lưu vào collection Qdrant của bạn → truy hồi theo câu hỏi → đưa đoạn liên quan vào prompt. Sau đó đăng ký agent qua <code>base_url</code>. Như vậy “memory/knowledge” thuộc về agent, tách biệt và dễ kiểm soát.</p>
      </section>

      <hr class="divider">

      <!-- CÁ NHÂN HOÁ -->
      <section id="ca-nhan-hoa">
        <span class="sec-tag cap">◆ Năng lực</span>
        <h2>Cá nhân hoá theo hồ sơ</h2>
        <p>Khi người dùng đã đăng nhập, Portal tự chèn hồ sơ vào ngữ cảnh để trợ lý xưng hô đúng và gợi ý sát nhu cầu. Hồ sơ nằm ở bảng <code>ai_portal.users</code>.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Cột users</th><th>Ý nghĩa</th></tr></thead>
          <tbody>
            <tr><td>full_name / display_name</td><td>Họ tên.</td></tr>
            <tr><td>position</td><td>Chức danh/chức vụ.</td></tr>
            <tr><td>academic_title / academic_degree</td><td>Học hàm / học vị.</td></tr>
            <tr><td>department_id</td><td>Đơn vị (join <code>departments.name</code>).</td></tr>
            <tr><td>direction (jsonb[])</td><td>Hướng nghiên cứu / định hướng.</td></tr>
            <tr><td>intro</td><td>Giới thiệu.</td></tr>
            <tr><td>google_scholar_url</td><td>Link Google Scholar.</td></tr>
          </tbody>
        </table></div>
        <p>API hồ sơ (<code>/api/users</code>): <code>GET /profile</code>, <code>GET/PATCH /me</code>, <code>GET /email/:identifier</code>, <code>GET /departments</code>.</p>
        <h3><span class="n">1</span> Hai cơ chế inject</h3>
        <ul>
          <li><strong>Central tự tra DB:</strong> <code>chat.ts</code> gắn <code>context.user_url</code>; orchestrator gọi <code>fetchUserProfileForCentral()</code> tra thẳng <code>ai_portal.users</code> rồi chèn khối “NGƯỜI DÙNG ĐANG ĐĂNG NHẬP” vào <strong>system prompt</strong>.</li>
          <li><strong>Làm giàu inline cho agent ngoài:</strong> vì agent ngoài không gọi được URL nội bộ, <code>chat.ts</code> tra sẵn và nhét vào <code>context.user_profile</code>.</li>
        </ul>
        <p class="pre-label">context.user_profile (agent ngoài nhận trong /ask)</p>
        <pre><code>{
  "email": "...", "full_name": "...", "display_name": "...",
  "position": "...", "academic_title": "...", "academic_degree": "...",
  "direction": ["..."], "department_name": "..."
}</code></pre>
        <div class="callout note"><span class="ci">🙈</span><p><b class="lbl">Riêng tư</b>Chỉ hồ sơ của <em>chính người đang đăng nhập</em> được đưa vào ngữ cảnh. Trợ lý chính <strong>không</strong> kéo dữ liệu cá nhân của người khác (hàm có cờ <code>pii:true</code> bị loại khỏi function-calling).</p></div>
      </section>

      <hr class="divider">

      <!-- PROJECT -->
      <section id="project">
        <span class="sec-tag cap">◆ Năng lực</span>
        <h2>Dự án (Project)</h2>
        <p>Dự án gom công việc/tài liệu/hội thoại theo đề tài. Bảng <code>ai_portal.projects</code>:</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Cột projects</th><th>Ý nghĩa</th></tr></thead>
          <tbody>
            <tr><td>id (uuid)</td><td>Định danh dự án.</td></tr>
            <tr><td>user_id</td><td>Chủ sở hữu.</td></tr>
            <tr><td>name / description</td><td>Tên &amp; mô tả.</td></tr>
            <tr><td>team_members (jsonb[])</td><td>Danh sách email chia sẻ/thành viên.</td></tr>
            <tr><td>file_keys (jsonb[])</td><td>Key file đính kèm (trong MinIO).</td></tr>
            <tr><td>tags (jsonb) / icon</td><td>Phân loại &amp; biểu tượng.</td></tr>
          </tbody>
        </table></div>
        <p>Routes: <code>GET /api/projects/:id</code> (public, dùng cho ngữ cảnh agent) · <code>GET/POST /api/users/projects</code> (liệt kê sở hữu + được chia sẻ; tạo mới) · <code>POST /api/users/projects/upload</code> (≤10 file) · <code>PATCH/DELETE /api/users/projects/:id</code>. Thêm email mới vào <code>team_members</code> sẽ tạo <strong>thông báo mời</strong> cho email đó. Bật/tắt tính năng: cài đặt <code>projects_enabled</code>.</p>
        <h3><span class="n">1</span> Ngữ cảnh dự án trong agent</h3>
        <p>Phiên chat lưu <code>chat_sessions.project_id</code> (UUID). Trong <code>/ask</code>, Portal truyền <code>context.project_id</code> và <code>context.project</code> (tên). Central chèn khối “DỰ ÁN NGƯỜI DÙNG ĐANG CHỌN” vào system prompt; agent ngoài nhận inline:</p>
        <pre><code>"project_info": { "name": "...", "description": "..." }</code></pre>
        <div class="callout warn"><span class="ci">⚠️</span><p><b class="lbl">Đừng nhầm <code>rid</code></b>Định danh dự án luôn là <code>project_id</code> (UUID). Frontend truyền id này qua tham số URL <code>rid</code>. Lưu ý: biến <code>rid</code> trong <em>orchestrator</em> lại là <em>request-id log ngẫu nhiên</em> — khác hoàn toàn, đừng dùng làm id dự án.</p></div>
      </section>

      <hr class="divider">

      <!-- FILE -->
      <section id="file">
        <span class="sec-tag cap">◆ Năng lực</span>
        <h2>File đính kèm</h2>
        <h3><span class="n">1</span> Upload &amp; lưu trữ</h3>
        <ul>
          <li>Upload chung: <code>/api/upload</code> — giới hạn <strong>25MB/file, tối đa 20 file</strong>. Lưu MinIO/S3.</li>
          <li>Upload theo dự án: <code>/api/users/projects/upload</code> — tối đa <strong>10 file</strong> (ghi vào <code>file_keys</code>).</li>
          <li>Storage: <code>/api/storage/*</code> — <code>GET /download/:key</code> (phục vụ asset), <code>list/info/stats</code>, xóa object/prefix. Cấu hình MinIO (<code>MINIO_*</code>) là <strong>bí mật</strong> — chỉ nêu tên biến, không nêu giá trị/host.</li>
        </ul>
        <h3><span class="n">2</span> Trích nội dung để gửi LLM</h3>
        <p>Client gửi trong body <code>/ask</code>: <code>context.extra_data.document = ["&lt;url&gt;", { "url":"...", "name":"..." }]</code>. Bộ đọc tài liệu nhận diện theo đuôi và trích văn bản:</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Định dạng</th><th>Xử lý</th></tr></thead>
          <tbody>
            <tr><td>PDF</td><td>Trích text.</td></tr>
            <tr><td>DOCX</td><td>Trích text thô.</td></tr>
            <tr><td>XLSX / XLS</td><td>Chuyển thành text theo sheet/tab.</td></tr>
            <tr><td>TXT / MD / CSV / JSON</td><td>Đọc UTF-8.</td></tr>
            <tr><td>PNG / JPG / GIF / WEBP</td><td>Base64 cho Vision API (image_url).</td></tr>
          </tbody>
        </table></div>
        <ul>
          <li><strong>Central:</strong> orchestrator gọi bộ đọc, nối text vào tin nhắn dưới nhãn <code>[Dữ liệu từ file đính kèm]</code>; ảnh đẩy thành <code>image_url</code> dạng data URI.</li>
          <li><strong>Agent ngoài:</strong> <code>chat.ts</code> <strong>parse sẵn</strong> và trả về <code>document[].text</code> để agent dùng ngay:</li>
        </ul>
        <pre><code>"context": { "extra_data": { "document": [
  { "url": "https://.../bao-cao.pdf", "name": "bao-cao.pdf", "text": "&lt;nội dung đã trích&gt;" }
] } }</code></pre>
        <p>Bảng <code>ai_portal.message_attachments</code> lưu metadata đính kèm: <code>message_id, file_name, file_url, mime_type, byte_size</code>.</p>
        <div class="callout danger"><span class="ci">🚫</span><p><b class="lbl">Không rewrite URL nội bộ ra ngoài</b>Bộ đọc tài liệu có logic đổi URL công khai của Portal về loopback nội bộ khi fetch (chống hairpin). Trong tài liệu/agent của bạn, <strong>không</strong> in ra hay hardcode các host/IP nội bộ này.</p></div>
      </section>

      <hr class="divider">

      <!-- ĐÓNG GÓI APP -->
      <section id="goi-app">
        <span class="sec-tag pkg">◆ Tool App</span>
        <h2>Đóng gói ứng dụng (.zip)</h2>
        <p>Có hai kiểu gói:</p>
        <p class="pre-label">Frontend-only (chỉ giao diện tĩnh)</p>
        <pre><code>manifest.json          // BẮT BUỘC (gốc zip)
public/
  index.html           // BẮT BUỘC
  assets/...
schema/                // tuỳ chọn</code></pre>
        <p class="pre-label">Bundled (có backend nhúng)</p>
        <pre><code>manifest.json
package.json           // từ backend (Portal chạy npm install)
public/                // frontend build
dist/
  server.js            // điểm vào standalone — KHÔNG .listen() khi nhúng
  embed.js             // export createEmbedRouter() (router Express)
data/                  // tuỳ chọn
schema/portal-embedded.sql  // tuỳ chọn (chạy khi cài, thay __SCHEMA__)</code></pre>
        <p>Kiểm tra khi cài (backend): phải có <code>manifest.json</code>; bundled cần <code>dist/server.js</code> &amp; <code>dist/embed.js</code> và <strong>embed.js không được gọi <code>.listen()</code></strong>; frontend-only cần <code>public/index.html</code>. Rác macOS (<code>__MACOSX</code>, <code>._*</code>, <code>.DS_Store</code>) bị loại; có chống zip-slip.</p>

        <h3><span class="n">1</span> Các trường <code>manifest.json</code></h3>
        <div class="table-wrap"><table>
          <thead><tr><th>Trường</th><th>Ý nghĩa</th></tr></thead>
          <tbody>
            <tr><td>alias</td><td><strong>Khóa chính</strong>: tên schema + đường dẫn <code>/tools|/embed|/api/apps/&lt;alias&gt;</code>. Chỉ <code>[a-z0-9_]</code>.</td></tr>
            <tr><td>name</td><td>Tên hiển thị.</td></tr>
            <tr><td>description</td><td>Mô tả — <strong>đưa vào prompt Central</strong> để định tuyến.</td></tr>
            <tr><td>icon</td><td>Tên icon Lucide (whitelist; sai → <code>Bot</code>).</td></tr>
            <tr><td>keywords</td><td>string[] để Central điều hướng “mở app” (VN + EN).</td></tr>
            <tr><td>version / type</td><td>Phiên bản; <code>type</code> thường <code>"embedded"</code>.</td></tr>
            <tr><td>hasBackend</td><td><code>true</code> → gói bundled.</td></tr>
            <tr><td>hasFrontendOnly</td><td><code>true</code> → gói chỉ có public/.</td></tr>
            <tr><td>supported_languages</td><td>vd <code>["vi","en"]</code>.</td></tr>
            <tr><td>apiProxyTarget</td><td>(frontend-only) host backend ngoài để iframe gọi — dùng placeholder, không nêu IP nội bộ.</td></tr>
            <tr><td>functions</td><td>Hàm Central gọi được (mục Function-calling).</td></tr>
          </tbody>
        </table></div>
        <div class="callout warn"><span class="ci">🧨</span><p><b class="lbl">Cảnh báo secret trong manifest</b>Có manifest thực (JournalConference) từng để <strong>IP nội bộ</strong> trong <code>description</code>. Khi viết manifest, <strong>không</strong> nhét host/IP/khóa vào bất kỳ trường nào — dùng biến môi trường phía backend app.</p></div>

        <h3><span class="n">2</span> Hai luồng cài đặt</h3>
        <ul>
          <li><strong>“Cài từ file (chỉ mình tôi)”</strong> — <code>POST /api/tools/install-package</code>: chỉ chấp nhận <strong>frontend-only</strong>; alias được đổi thành <code>u-&lt;8 ký tự user id&gt;-&lt;alias&gt;</code>, chỉ bạn thấy/gỡ.</li>
          <li><strong>“Cài cho mọi người (Admin)”</strong> — <code>POST /api/admin/tools/install-package</code>: chấp nhận cả bundled; chạy <code>schema/portal-embedded.sql</code>, <code>npm install</code>, rồi mount app. Chỉ tool global (<code>user_id IS NULL</code>) mới được Central expose functions.</li>
        </ul>
      </section>

      <hr class="divider">

      <!-- NHÚNG -->
      <section id="nhung">
        <span class="sec-tag pkg">◆ Tool App</span>
        <h2>Nhúng &amp; runtime</h2>
        <p>Người dùng mở <code>/tools/&lt;alias&gt;</code> → Portal render iframe <code>src = &lt;basePath&gt;/embed/&lt;alias&gt;?theme=…&amp;locale=…</code>. Backend đọc <code>public/index.html</code> của app rồi <strong>inject biến global</strong> vào <code>&lt;head&gt;</code>:</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Biến inject</th><th>Mục đích</th></tr></thead>
          <tbody>
            <tr><td>window.__WRITE_API_BASE__ / __DATA_API_BASE__</td><td>Base URL để app gọi backend của chính nó (<code>/api/apps/&lt;alias&gt;</code>).</td></tr>
            <tr><td>window.__PORTAL_THEME__</td><td>Theme ban đầu (<code>light</code>/<code>dark</code>) + class trên <code>&lt;html&gt;</code>.</td></tr>
            <tr><td>window.__AI_PORTAL_LOCALE__</td><td>Ngôn ngữ Portal.</td></tr>
            <tr><td>window.__PORTAL_USER__</td><td>User context <code>{id,email,name}</code> khi iframe không nhận cookie.</td></tr>
            <tr><td>window.__PORTAL_BASE_PATH__</td><td>basePath để điều hướng nội bộ.</td></tr>
          </tbody>
        </table></div>
        <h3><span class="n">1</span> Contract postMessage</h3>
        <ul>
          <li><strong>Portal → app:</strong> <code>{ type:"portal-theme", theme }</code> (đổi theme), <code>{ type:"PORTAL_USER", user }</code>.</li>
          <li><strong>App → Portal:</strong> khi chưa có user, phát <code>{ type:"PORTAL_APP_NEED_USER" }</code> (hoặc biến thể riêng) → Portal trả <code>PORTAL_USER</code>.</li>
        </ul>
        <p>App nên đọc API base <strong>mỗi lần gọi</strong> từ <code>window.__WRITE_API_BASE__</code> (không cache lúc import), và lắng nghe <code>message</code>/<code>storage</code> để đồng bộ theme.</p>
        <h3><span class="n">2</span> App gọi backend của chính nó</h3>
        <p>Bundled: request tới <code>/api/apps/&lt;alias&gt;/…</code> được dispatcher bắt, nạp <code>dist/embed.js</code> (<code>createEmbedRouter()</code>) chạy trong process backend. Trước router, middleware gắn header <code>X-User-Id / X-User-Email / X-User-Name</code> và phục vụ <code>GET /api/auth/me</code>. Mỗi app dùng <strong>schema Postgres riêng</strong> (tên = alias) qua async-context, đọc <code>process.env.DB_SCHEMA</code> như bình thường.</p>
      </section>

      <hr class="divider">

      <!-- FUNCTIONS -->
      <section id="functions">
        <span class="sec-tag pkg">◆ Tool App</span>
        <h2>Function-calling với Trợ lý chính</h2>
        <p>Khai báo <code>functions</code> trong manifest để Central gọi trực tiếp và trả lời ngay trong chat (không cần mở app).</p>
        <p class="pre-label">Một phần tử functions</p>
        <pre><code>{
  "name": "search_journals",         // [a-zA-Z0-9_]{1,48}; Central đặt tool = "&lt;alias&gt;__&lt;name&gt;"
  "description": "Tra cứu tạp chí theo lĩnh vực...",
  "method": "GET",                   // GET | POST
  "endpoint": "/api/journals",       // path trên router embed; bắt đầu "/", không chứa ".."
  "parameters": {                    // JSON Schema cho tham số LLM sinh
    "type": "object",
    "properties": {
      "search":   { "type": "string",  "description": "Từ khóa TIẾNG ANH" },
      "quartile": { "type": "string",  "enum": ["Q1","Q2","Q3","Q4"] },
      "limit":    { "type": "integer" }
    },
    "required": ["search"]
  },
  "resultTrim": { "data": 5 },       // tuỳ chọn: cắt mảng dài -> { field: maxItems }
  "pii": true                        // tuỳ chọn: true -> KHÔNG expose cho Central
}</code></pre>
        <p>Cơ chế: orchestrator đọc manifest các tool global, sinh tool def cho LLM (tên <code>&lt;alias&gt;__&lt;name&gt;</code>, mô tả <code>[Tên app] description</code>), loại hàm <code>pii:true</code>. Khi LLM gọi, Portal gọi loopback <code>/api/apps/&lt;alias&gt;&lt;endpoint&gt;</code> (GET → query string; POST → body JSON), timeout ~15s, áp <code>resultTrim</code> rồi cap ~8000 ký tự. Prompt ép Central chỉ dùng dữ liệu hàm trả về, không bịa số; nếu rỗng thì gợi ý mở <code>[Tên](/tools/&lt;alias&gt;)</code>.</p>
        <p><strong>Điều hướng bằng <code>keywords</code>:</strong> keywords được nối vào prompt Central; khi câu người dùng khớp (“mở …”, “phân tích định tính”…), Central gợi ý mở app qua link <code>/tools/&lt;alias&gt;</code>. Đặt keywords cả VN lẫn EN.</p>
        <h3><span class="n">1</span> Thêm một hàm gọi được</h3>
        <ol class="steps">
          <li><span class="st">Thêm route backend</span> vd <code>router.get("/api/my-search", handler)</code> trả JSON.</li>
          <li><span class="st">Khai vào manifest</span> thêm phần tử <code>functions</code> với <code>name/description/method/endpoint/parameters</code> (+ <code>resultTrim</code> nếu mảng dài, <code>pii:true</code> nếu dữ liệu cá nhân).</li>
          <li><span class="st">Đóng gói &amp; cài “cho mọi người (Admin)”</span> → Central tự phát hiện hàm (chỉ tool global mới được expose).</li>
          <li><span class="st">Kiểm thử</span> hỏi Central một câu khớp để xác nhận nó gọi hàm.</li>
        </ol>
      </section>

      <hr class="divider">

      <!-- LOCAL DEV -->
      <section id="local-dev">
        <span class="sec-tag pkg">◆ Tool App</span>
        <h2>Phát triển cục bộ</h2>
        <ul>
          <li><strong>Chạy:</strong> <code>npm run dev</code> (Vite frontend); app có backend: <code>npm run start</code> / <code>npm run dev:full</code> (chạy song song). <code>npm run install:all</code> cài cả gốc &amp; backend.</li>
          <li><strong>API base:</strong> dev đọc <code>VITE_&lt;APP&gt;_API_URL</code> từ <code>.env</code> (không commit giá trị nhạy cảm); khi nhúng, app <strong>ưu tiên</strong> <code>window.__WRITE_API_BASE__</code> — không cần cấu hình thêm.</li>
          <li><strong>Build nhúng:</strong> <code>vite.config.ts</code> đặt <code>base = process.env.EMBED_BASE_PATH || "./"</code>. Thường chỉ cần <code>npm run build</code> (base <code>./</code>) vì Portal tự rewrite path; chỉ dùng <code>build:basepath</code> khi deploy dưới subpath cố định.</li>
          <li><strong>Đóng gói:</strong> <code>npm run pack</code> → tạo <code>.zip</code>. Bundled pack kiểm tra bắt buộc có <code>backend/dist/server.js</code> &amp; <code>embed.js</code>.</li>
        </ul>
        <div class="callout tip"><span class="ci">✅</span><p><b class="lbl">Kiểm thử nhanh</b>Sau khi cài: mở <code>/tools/&lt;alias&gt;</code>, thử đổi theme sáng/tối, đăng nhập &amp; guest; nếu có <code>functions</code>, hỏi Central câu khớp để chắc chắn nó gọi được hàm.</p></div>
      </section>

      <hr class="divider">

      <!-- ROUTING -->
      <section id="routing">
        <span class="sec-tag">● Khác</span>
        <h2>Định tuyến mô hình (tổng quan)</h2>
        <p>Mọi lời gọi LLM đi qua một <strong>Gateway thống nhất</strong> phía sau một API chung (ẩn khác biệt nhà cung cấp), có ghi log có cấu trúc (app, loại tác vụ, vai trò người dùng, latency, token, chi phí, feedback). Một <strong>router thích ứng</strong> (contextual bandit) chọn model trong pool nhiều tầng dựa trên đặc trưng ngữ nghĩa + app + vai trò người dùng, tối ưu cân bằng <em>chất lượng · chi phí · độ trễ</em>, cập nhật online theo phản hồi.</p>
        <div class="callout note"><span class="ci">🧩</span><p><b class="lbl">Với nhà phát triển</b>App/agent <strong>không hardcode nhà cung cấp model</strong>; gọi qua Gateway chung, việc chọn model là trong suốt. Không đưa URL Gateway / endpoint model / khóa vào mã app hay tài liệu.</p></div>
      </section>

      <hr class="divider">

      <!-- ADMIN/DEV -->
      <section id="admin-dev">
        <span class="sec-tag">● Khác</span>
        <h2>Bề mặt Admin/Dev</h2>
        <ul>
          <li><strong>Admin → “Công cụ”:</strong> cài từ gói (stream tiến trình), cài lại, <strong>Tải gói về</strong> (nhân bản), <strong>Backup/Restore DB</strong> theo schema=alias, sửa icon/ghim/thứ tự, gán danh mục, giới hạn tin/ngày, bật/tắt, xóa.</li>
          <li><strong>Admin → “Trợ lý”:</strong> CRUD agent, cấu hình nhúng, Test agent.</li>
          <li><strong>Admin → “Central” / “Qdrant”:</strong> cấu hình LLM trung tâm; kết nối &amp; kiểm thử collection.</li>
          <li><strong>Mã nhúng:</strong> sinh iframe/script cho <code>/assistant-embed/&lt;alias&gt;</code> để nhúng widget chat ra site ngoài (tham số theme/màu).</li>
          <li><strong>Tài liệu nhà phát triển in-app:</strong> <code>/devs/docs</code> render từ <code>docs/README.md</code>.</li>
        </ul>
      </section>

      <hr class="divider">

      <!-- CHECKLIST -->
      <section id="checklist">
        <span class="sec-tag">● Khác</span>
        <h2>Checklist</h2>
        <p><strong>Đăng ký một agent chuyên biệt</strong></p>
        <ol>
          <li>Chạy service expose <code>/metadata</code>, <code>/data</code>, <code>/ask</code> đúng shape; hỗ trợ SSE cho <code>/ask</code>.</li>
          <li>Dùng <code>context.user_profile</code>, <code>context.project_info</code>, <code>document[].text</code> để cá nhân hoá &amp; đọc file.</li>
          <li>Đăng ký qua Admin “Trợ lý” (hoặc <code>POST /api/admin/agents</code>) với <code>base_url</code> + <code>routing_hint</code>.</li>
          <li>Test bằng nút Test; bật <code>central_routing_enabled</code> nếu muốn Central tự định tuyến.</li>
        </ol>
        <p><strong>Đóng gói một Tool App</strong></p>
        <ol>
          <li>Chọn <code>alias</code> (<code>[a-z0-9_]</code>), viết <code>manifest.json</code> đủ trường.</li>
          <li>App đọc API base từ <code>window.__WRITE_API_BASE__</code>; theme từ <code>__PORTAL_THEME__</code> + postMessage; user từ <code>__PORTAL_USER__</code>.</li>
          <li>Backend (nếu có): export <code>createEmbedRouter()</code>, <strong>không</strong> <code>.listen()</code> khi nhúng; dùng <code>process.env.DB_SCHEMA</code>.</li>
          <li>(Tuỳ chọn) khai <code>functions</code> + <code>keywords</code>.</li>
          <li><code>npm run build</code> → <code>npm run pack</code> → cài (frontend-only tự cài; bundled qua Admin).</li>
        </ol>
      </section>

      <hr class="divider">

      <!-- BẢO MẬT -->
      <section id="bao-mat">
        <span class="sec-tag">● Khác</span>
        <h2>Bảo mật &amp; lưu ý</h2>
        <ul>
          <li><strong>Không hardcode bí mật</strong> (API key LLM, khóa MinIO, <code>NEXTAUTH_SECRET</code>, chuỗi kết nối DB) trong mã app/agent, manifest hay tài liệu. Đặt trong biến môi trường / bảng cài đặt.</li>
          <li><strong>Không lộ host/IP nội bộ</strong> (Gateway, Qdrant, MinIO, upstream) ra frontend, manifest hay bản build công khai.</li>
          <li>Dữ liệu cá nhân: đánh dấu <code>pii:true</code> cho function trả dữ liệu người dùng để Central không kéo qua chat.</li>
          <li>App bundled dùng <strong>schema riêng theo alias</strong> — không truy vấn chéo schema của app khác.</li>
          <li>Kiểm soát truy cập nhúng: đặt <code>embed_allowed_domains</code> thay vì <code>embed_allow_all</code> nếu không cần mở toàn bộ.</li>
        </ul>
        <div class="callout note"><span class="ci">📄</span><p>Cần chi tiết sâu hơn (DDL bảng, body <code>/ask</code> đầy đủ, ví dụ router embed)? Xem tài liệu in-app tại <code>/devs/docs</code> hoặc liên hệ nhóm phát triển.</p></div>
      </section>

      <footer>
        <p><strong>Research — Đại học Kinh tế Quốc dân (NEU).</strong> Tài liệu kỹ thuật cho nhà phát triển · Chỉ dành cho tài khoản NEU. Cập nhật theo phiên bản hệ thống.</p>
      </footer>
    </div>
  </main>
</div>
<button class="backtop" id="backTop" aria-label="Lên đầu trang">↑</button>
<script>
(function(){
  var root=document.documentElement, themeBtn=document.getElementById('themeBtn');
  var stored=null; try{stored=localStorage.getItem('rs-theme')}catch(e){}
  if(stored) root.setAttribute('data-theme',stored);
  function cur(){return root.getAttribute('data-theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
  themeBtn.addEventListener('click',function(){var n=cur()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('rs-theme',n)}catch(e){}});
  var body=document.body, sidebar=document.getElementById('sidebar');
  document.getElementById('menuBtn').addEventListener('click',function(){body.classList.toggle('nav-open')});
  document.getElementById('scrim').addEventListener('click',function(){body.classList.remove('nav-open')});
  sidebar.addEventListener('click',function(e){if(e.target.tagName==='A')body.classList.remove('nav-open')});
  var progress=document.getElementById('progress'), backTop=document.getElementById('backTop'), ticking=false;
  window.addEventListener('scroll',function(){if(ticking)return;ticking=true;requestAnimationFrame(function(){var h=document.documentElement,max=h.scrollHeight-h.clientHeight;progress.style.width=(max>0?(h.scrollTop/max)*100:0)+'%';backTop.classList.toggle('show',h.scrollTop>600);ticking=false})},{passive:true});
  backTop.addEventListener('click',function(){window.scrollTo({top:0,behavior:'smooth'})});
  var links=Array.prototype.slice.call(sidebar.querySelectorAll('a[href^="#"]'));
  var map={}; links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
  var secEls=links.map(function(a){return document.getElementById(a.getAttribute('href').slice(1))}).filter(Boolean);
  var current=null;
  function setActive(id){if(id===current)return;current=id;links.forEach(function(a){a.classList.remove('active')});if(map[id]){map[id].classList.add('active');map[id].scrollIntoView({block:'nearest'})}}
  if('IntersectionObserver' in window){var vis={};var io=new IntersectionObserver(function(en){en.forEach(function(e){vis[e.target.id]=e.isIntersecting?e.intersectionRatio:0});var best=null,br=0;secEls.forEach(function(s){var r=vis[s.id]||0;if(r>br){br=r;best=s.id}});if(best)setActive(best)},{rootMargin:'-72px 0px -55% 0px',threshold:[0,.25,.5,1]});secEls.forEach(function(s){io.observe(s)})}
})();
</script>
</body>
</html>`;

/** Small styled page shown to non-NEU visitors, with a login link. */
export function buildGateHtml(loginUrl: string, wrongAccount: boolean): string {
  const line = wrongAccount
    ? "Tài khoản bạn đang đăng nhập không phải email NEU nên chưa xem được tài liệu này."
    : "Tài liệu dành cho nhà phát triển chỉ mở cho tài khoản email NEU (@neu.edu.vn)."
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Cần đăng nhập NEU — Hướng dẫn Developer</title>
<style>
  :root{color-scheme:light dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#0d1017;color:#e6e9ef}
  @media (prefers-color-scheme:light){body{background:#f4f7fb;color:#1b2430}}
  .card{max-width:440px;width:100%;text-align:center;border:1px solid #26303c;border-radius:16px;
    background:#141922;padding:34px 28px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
  @media (prefers-color-scheme:light){.card{background:#fff;border-color:#e3e8ef;box-shadow:0 8px 30px rgba(23,40,64,.08)}}
  .mark{font-size:40px;line-height:1}
  h1{font-size:21px;margin:14px 0 8px;letter-spacing:-.01em}
  p{margin:0 0 20px;color:#97a1b0;font-size:15px;line-height:1.6}
  @media (prefers-color-scheme:light){p{color:#5b6675}}
  a.btn{display:inline-block;background:#1E5AA8;color:#fff;text-decoration:none;font-weight:650;
    padding:11px 22px;border-radius:10px;font-size:15px}
  a.btn:hover{background:#17427C}
  .home{display:block;margin-top:16px;color:#5b93d6;text-decoration:none;font-size:13.5px}
</style></head>
<body><div class="card">
  <div class="mark">🔒</div>
  <h1>Cần tài khoản NEU</h1>
  <p>${line}</p>
  <a class="btn" href="${loginUrl}">Đăng nhập bằng email NEU</a>
  <a class="home" href="huong-dan.html">← Về Hướng dẫn sử dụng</a>
</div></body></html>`
}
