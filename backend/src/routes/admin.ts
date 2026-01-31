// routes/admin.ts
import { Router, Request, Response } from "express"
import { query } from "../lib/db"
import path from "path"
import fs from "fs"

const router = Router()

// Cho phép admin routes nếu:
// 1. NODE_ENV === "development"
// 2. Hoặc ENABLE_ADMIN_ROUTES === "true"
const isDevelopment = process.env.NODE_ENV === "development"
const adminEnabled = process.env.ENABLE_ADMIN_ROUTES === "true"
const allowAdmin = isDevelopment || adminEnabled

// Middleware kiểm tra quyền truy cập admin
const adminOnly = (req: Request, res: Response, next: any) => {
  if (!allowAdmin) {
    return res.status(403).json({ 
      error: "Admin routes chỉ khả dụng trong development mode hoặc khi ENABLE_ADMIN_ROUTES=true",
      hint: "Đặt NODE_ENV=development hoặc ENABLE_ADMIN_ROUTES=true trong .env để kích hoạt"
    })
  }
  next()
}

// GET /api/admin/db/tables - Lấy danh sách tất cả tables
router.get("/db/tables", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'research_chat'
      ORDER BY table_schema, table_name
    `)
    
    res.json({ 
      tables: result.rows,
      total: result.rows.length
    })
  } catch (err: any) {
    console.error("Error fetching tables:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined
    })
  }
})

// GET /api/admin/db/table/:tableName - Xem dữ liệu từ một table cụ thể
router.get("/db/table/:tableName", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    
    // Kiểm tra table có tồn tại không
    const tableCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'research_chat' AND table_name = $1
    `, [tableName])
    
    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema 'research_chat'` })
    }
    
    // Lấy schema của table
    const schemaResult = await query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'research_chat' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName])
    
    // Kiểm tra xem table có column updated_at không
    const hasUpdatedAt = schemaResult.rows.some((col: any) => col.column_name === "updated_at")
    const hasCreatedAt = schemaResult.rows.some((col: any) => col.column_name === "created_at")
    
    // Xây dựng ORDER BY clause dựa trên columns có sẵn
    let orderBy = ""
    if (hasCreatedAt && hasUpdatedAt) {
      orderBy = "ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST"
    } else if (hasCreatedAt) {
      orderBy = "ORDER BY created_at DESC NULLS LAST"
    } else if (hasUpdatedAt) {
      orderBy = "ORDER BY updated_at DESC NULLS LAST"
    }
    
    // Lấy dữ liệu từ table
    const dataResult = await query(`
      SELECT * FROM research_chat.${tableName}
      ${orderBy}
      LIMIT $1 OFFSET $2
    `, [limit, offset])
    
    // Đếm tổng số rows
    const countResult = await query(`
      SELECT COUNT(*) as total FROM research_chat.${tableName}
    `)
    
    res.json({
      table: tableName,
      schema: schemaResult.rows,
      data: dataResult.rows,
      pagination: {
        limit,
        offset,
        total: Number(countResult.rows[0]?.total || 0)
      }
    })
  } catch (err: any) {
    console.error("Error fetching table data:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined
    })
  }
})

// POST /api/admin/db/query - Thực thi query SQL tùy chỉnh (chỉ SELECT)
router.post("/db/query", adminOnly, async (req: Request, res: Response) => {
  try {
    const { sql } = req.body
    
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: "SQL query là bắt buộc" })
    }
    
    // Chỉ cho phép SELECT queries để bảo mật
    const trimmedSql = sql.trim().toUpperCase()
    if (!trimmedSql.startsWith("SELECT")) {
      return res.status(400).json({ error: "Chỉ cho phép SELECT queries" })
    }
    
    // Giới hạn số rows trả về
    let finalSql = sql.trim()
    if (!finalSql.toUpperCase().includes("LIMIT")) {
      finalSql += " LIMIT 1000"
    }
    
    const result = await query(finalSql)
    
    res.json({
      rows: result.rows,
      rowCount: result.rows.length,
      columns: result.rows.length > 0 ? Object.keys(result.rows[0]) : []
    })
  } catch (err: any) {
    console.error("Error executing query:", err)
    res.status(500).json({ 
      error: "Query Error",
      message: err.message,
      code: err.code
    })
  }
})

// GET /api/admin/db/stats - Thống kê database
router.get("/db/stats", adminOnly, async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT 
        'users' as table_name, COUNT(*) as row_count FROM research_chat.users
      UNION ALL
      SELECT 
        'chat_sessions', COUNT(*) FROM research_chat.chat_sessions
      UNION ALL
      SELECT 
        'messages', COUNT(*) FROM research_chat.messages
      UNION ALL
      SELECT 
        'message_attachments', COUNT(*) FROM research_chat.message_attachments
    `)
    
    res.json({ stats: stats.rows })
  } catch (err: any) {
    console.error("Error fetching stats:", err)
    res.status(500).json({ 
      error: "Internal Server Error",
      message: allowAdmin ? err.message : undefined
    })
  }
})

// GET /api/admin/view - Trang web để xem database
router.get("/view", adminOnly, (req: Request, res: Response) => {
  try {
    // Tìm file HTML từ nhiều vị trí có thể
    const possiblePaths = [
      path.join(__dirname, "admin-view.html"),
      path.join(process.cwd(), "src/routes/admin-view.html"),
      path.join(process.cwd(), "backend/src/routes/admin-view.html"),
    ]
    
    let htmlPath: string | null = null
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        htmlPath = p
        break
      }
    }
    
    if (htmlPath) {
      res.sendFile(htmlPath)
    } else {
      // Fallback: trả về HTML inline nếu không tìm thấy file
      res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Viewer - Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px; }
        h1 { color: #333; margin-bottom: 24px; border-bottom: 2px solid #007bff; padding-bottom: 12px; }
        .tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid #ddd; }
        .tab { padding: 12px 24px; cursor: pointer; border: none; background: none; font-size: 14px; color: #666; border-bottom: 2px solid transparent; }
        .tab:hover { color: #007bff; }
        .tab.active { color: #007bff; border-bottom-color: #007bff; font-weight: 600; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
        .stat-card h3 { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
        .stat-card .value { font-size: 32px; font-weight: bold; }
        .table-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .table-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 16px; cursor: pointer; transition: all 0.2s; }
        .table-card:hover { background: #e9ecef; border-color: #007bff; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .table-card h3 { color: #333; margin-bottom: 8px; font-size: 16px; }
        .table-card .meta { color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; color: #495057; position: sticky; top: 0; }
        tr:hover { background: #f8f9fa; }
        .loading { text-align: center; padding: 40px; color: #666; }
        .error { background: #fee; color: #c33; padding: 12px; border-radius: 4px; margin: 16px 0; }
        .query-box { margin-bottom: 16px; }
        textarea { width: 100%; min-height: 120px; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 14px; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; margin-top: 8px; }
        button:hover { background: #0056b3; }
        .pagination { display: flex; gap: 8px; margin-top: 16px; align-items: center; }
        .pagination .info { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗄️ Database Viewer - Admin Panel</h1>
        <div class="tabs">
            <button class="tab active" onclick="showTab('stats')">Thống kê</button>
            <button class="tab" onclick="showTab('tables')">Tables</button>
            <button class="tab" onclick="showTab('query')">SQL Query</button>
        </div>
        <div id="stats" class="tab-content active">
            <div class="stats-grid" id="statsGrid"><div class="loading">Đang tải thống kê...</div></div>
        </div>
        <div id="tables" class="tab-content">
            <div id="tablesList" class="table-list"><div class="loading">Đang tải danh sách tables...</div></div>
            <div id="tableData"></div>
        </div>
        <div id="query" class="tab-content">
            <div class="query-box">
                <textarea id="sqlQuery" placeholder="SELECT * FROM research_chat.users LIMIT 10;">SELECT * FROM research_chat.users LIMIT 10;</textarea>
                <button onclick="executeQuery()">Thực thi Query</button>
            </div>
            <div id="queryResult"></div>
        </div>
    </div>
    <script>
        const API_BASE = window.location.origin + '/api/admin';
        function showTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            if (tabName === 'stats') loadStats();
            if (tabName === 'tables') loadTables();
        }
        async function loadStats() {
            try {
                const res = await fetch(API_BASE + '/db/stats');
                const data = await res.json();
                document.getElementById('statsGrid').innerHTML = data.stats.map(stat => 
                    '<div class="stat-card"><h3>' + stat.table_name + '</h3><div class="value">' + stat.row_count + '</div></div>'
                ).join('');
            } catch (err) {
                document.getElementById('statsGrid').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        async function loadTables() {
            try {
                const res = await fetch(API_BASE + '/db/tables');
                const data = await res.json();
                document.getElementById('tablesList').innerHTML = data.tables.map(table => 
                    '<div class="table-card" onclick="loadTableData(\\'' + table.table_name + '\\')"><h3>' + table.table_name + '</h3><div class="meta">Schema: ' + table.table_schema + ' • Columns: ' + table.column_count + '</div></div>'
                ).join('');
            } catch (err) {
                document.getElementById('tablesList').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        async function loadTableData(tableName) {
            document.getElementById('tableData').innerHTML = '<div class="loading">Đang tải dữ liệu...</div>';
            try {
                const res = await fetch(API_BASE + '/db/table/' + tableName + '?limit=100');
                const data = await res.json();
                if (data.data.length === 0) {
                    document.getElementById('tableData').innerHTML = '<div class="error">Không có dữ liệu</div>';
                    return;
                }
                const columns = Object.keys(data.data[0]);
                const header = '<h2>' + data.table + ' (' + data.pagination.total + ' rows)</h2>';
                const tableHeader = '<tr>' + columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
                const tableRows = data.data.map(row => '<tr>' + columns.map(col => '<td>' + formatValue(row[col]) + '</td>').join('') + '</tr>').join('');
                document.getElementById('tableData').innerHTML = header + '<div style="overflow-x: auto; max-height: 600px; overflow-y: auto;"><table>' + tableHeader + tableRows + '</table></div>';
            } catch (err) {
                document.getElementById('tableData').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        async function executeQuery() {
            const sql = document.getElementById('sqlQuery').value.trim();
            if (!sql) return;
            document.getElementById('queryResult').innerHTML = '<div class="loading">Đang thực thi query...</div>';
            try {
                const res = await fetch(API_BASE + '/db/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql })
                });
                const data = await res.json();
                if (data.error) {
                    document.getElementById('queryResult').innerHTML = '<div class="error">Lỗi: ' + (data.message || data.error) + '</div>';
                    return;
                }
                if (data.rows.length === 0) {
                    document.getElementById('queryResult').innerHTML = '<div class="error">Không có kết quả</div>';
                    return;
                }
                const columns = data.columns;
                const tableHeader = '<tr>' + columns.map(col => '<th>' + col + '</th>').join('') + '</tr>';
                const tableRows = data.rows.map(row => '<tr>' + columns.map(col => '<td>' + formatValue(row[col]) + '</td>').join('') + '</tr>').join('');
                document.getElementById('queryResult').innerHTML = '<div style="margin-top: 16px;"><div class="pagination info">Kết quả: ' + data.rowCount + ' rows</div><div style="overflow-x: auto; max-height: 600px; overflow-y: auto;"><table>' + tableHeader + tableRows + '</table></div></div>';
            } catch (err) {
                document.getElementById('queryResult').innerHTML = '<div class="error">Lỗi: ' + err.message + '</div>';
            }
        }
        function formatValue(value) {
            if (value === null || value === undefined) return '<em style="color: #999;">null</em>';
            if (typeof value === 'object') return JSON.stringify(value);
            if (typeof value === 'boolean') return value ? '✓' : '✗';
            return String(value);
        }
        loadStats();
    </script>
</body>
</html>
      `)
    }
  } catch (err: any) {
    console.error("Error serving admin view:", err)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

export default router
