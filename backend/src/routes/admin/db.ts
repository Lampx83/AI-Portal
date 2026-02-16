import { Router, Request, Response } from "express"
import { query } from "../../lib/db"
import { getBootstrapEnv } from "../../lib/settings"
import { adminOnly, allowAdmin } from "./middleware"

const router = Router()

async function getTableSchema(tableName: string): Promise<{ schema: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]; primaryKey: string[] } | null> {
  const safeName = String(tableName).replace(/[^a-zA-Z0-9_]/g, "")
  const tableCheck = await query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'ai_portal' AND table_name = $1`,
    [safeName]
  )
  if (tableCheck.rows.length === 0) return null
  const schemaResult = await query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema = 'ai_portal' AND table_name = $1 ORDER BY ordinal_position`,
    [safeName]
  )
  const pkResult = await query(
    `SELECT kcu.column_name FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
     WHERE tc.table_schema = 'ai_portal' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position`,
    [safeName]
  )
  const primaryKey = (pkResult.rows as { column_name: string }[]).map((r) => r.column_name)
  return { schema: schemaResult.rows as any, primaryKey }
}

router.get("/tables", adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = t.table_schema AND table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'ai_portal'
      ORDER BY table_schema, table_name
    `)
    res.json({ tables: result.rows, total: result.rows.length })
  } catch (err: any) {
    console.error("Error fetching tables:", err)
    res.status(500).json({ error: "Internal Server Error", message: allowAdmin ? err.message : undefined })
  }
})

router.get("/table/:tableName", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    const tableCheck = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'ai_portal' AND table_name = $1`,
      [tableName]
    )
    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema 'ai_portal'` })
    }
    const schemaResult = await query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = 'ai_portal' AND table_name = $1 ORDER BY ordinal_position`,
      [tableName]
    )
    const pkResult = await query(
      `SELECT kcu.column_name FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu ON tc.constraint_schema = kcu.constraint_schema AND tc.constraint_name = kcu.constraint_name
       WHERE tc.table_schema = 'ai_portal' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY' ORDER BY kcu.ordinal_position`,
      [tableName]
    )
    const primaryKey = (pkResult.rows as { column_name: string }[]).map((r) => r.column_name)
    const hasUpdatedAt = schemaResult.rows.some((col: any) => col.column_name === "updated_at")
    const hasCreatedAt = schemaResult.rows.some((col: any) => col.column_name === "created_at")
    let orderBy = ""
    if (hasCreatedAt && hasUpdatedAt) orderBy = "ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST"
    else if (hasCreatedAt) orderBy = "ORDER BY created_at DESC NULLS LAST"
    else if (hasUpdatedAt) orderBy = "ORDER BY updated_at DESC NULLS LAST"
    const dataResult = await query(`SELECT * FROM ai_portal.${tableName} ${orderBy} LIMIT $1 OFFSET $2`, [limit, offset])
    const countResult = await query(`SELECT COUNT(*) as total FROM ai_portal.${tableName}`)
    res.json({
      table: tableName,
      schema: schemaResult.rows,
      primary_key: primaryKey,
      data: dataResult.rows,
      pagination: { limit, offset, total: Number(countResult.rows[0]?.total || 0) },
    })
  } catch (err: any) {
    console.error("Error fetching table data:", err)
    res.status(500).json({ error: "Internal Server Error", message: allowAdmin ? err.message : undefined })
  }
})

router.post("/table/:tableName/row", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const meta = await getTableSchema(tableName)
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema ai_portal` })
    const { schema } = meta
    const row = req.body?.row
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return res.status(400).json({ error: "Body phải có dạng { row: { column: value, ... } }" })
    }
    const columnNames = schema.map((c: any) => c.column_name)
    const allowed = Object.keys(row).filter((k) => columnNames.includes(k))
    if (allowed.length === 0) return res.status(400).json({ error: "Không có cột hợp lệ trong row" })
    const values = allowed.map((col) => row[col])
    const cols = allowed.join(", ")
    const placeholders = allowed.map((_, i) => `$${i + 1}`).join(", ")
    const result = await query(`INSERT INTO ai_portal.${tableName} (${cols}) VALUES (${placeholders}) RETURNING *`, values)
    res.status(201).json({ row: result.rows[0], message: "Đã thêm dòng" })
  } catch (err: any) {
    console.error("Error inserting row:", err)
    res.status(500).json({ error: "Lỗi thêm dòng", message: err?.message })
  }
})

router.put("/table/:tableName/row", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const meta = await getTableSchema(tableName)
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema ai_portal` })
    const { schema, primaryKey } = meta
    if (primaryKey.length === 0) return res.status(400).json({ error: "Table không có primary key, không thể sửa theo dòng" })
    const { pk, row: rowData } = req.body || {}
    if (!pk || typeof pk !== "object" || !rowData || typeof rowData !== "object") {
      return res.status(400).json({ error: "Body phải có dạng { pk: { pk_col: value }, row: { column: value, ... } }" })
    }
    const columnNames = schema.map((c: any) => c.column_name)
    const setCols = Object.keys(rowData).filter((k) => columnNames.includes(k) && !primaryKey.includes(k))
    if (setCols.length === 0) return res.status(400).json({ error: "Không có cột nào để cập nhật (không sửa cột primary key)" })
    const setClause = setCols.map((c, i) => `${c} = $${i + 1}`).join(", ")
    const whereClause = primaryKey.map((c, i) => `${c} = $${setCols.length + i + 1}`).join(" AND ")
    const values = [...setCols.map((c) => rowData[c]), ...primaryKey.map((c) => pk[c])]
    const result = await query(`UPDATE ai_portal.${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *`, values)
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy dòng với primary key đã cho" })
    res.json({ row: result.rows[0], message: "Đã cập nhật dòng" })
  } catch (err: any) {
    console.error("Error updating row:", err)
    res.status(500).json({ error: "Lỗi cập nhật dòng", message: err?.message })
  }
})

router.delete("/table/:tableName/row", adminOnly, async (req: Request, res: Response) => {
  try {
    const tableName = String(req.params.tableName).replace(/[^a-zA-Z0-9_]/g, "")
    const meta = await getTableSchema(tableName)
    if (!meta) return res.status(404).json({ error: `Table '${tableName}' không tồn tại trong schema ai_portal` })
    const { primaryKey } = meta
    if (primaryKey.length === 0) return res.status(400).json({ error: "Table không có primary key, không thể xóa theo dòng" })
    const pk = req.body?.pk
    if (!pk || typeof pk !== "object") return res.status(400).json({ error: "Body phải có dạng { pk: { pk_col: value } }" })
    const whereClause = primaryKey.map((c, i) => `${c} = $${i + 1}`).join(" AND ")
    const values = primaryKey.map((c) => pk[c])
    const result = await query(`DELETE FROM ai_portal.${tableName} WHERE ${whereClause} RETURNING *`, values)
    if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy dòng với primary key đã cho" })
    res.json({ deleted: result.rows[0], message: "Đã xóa dòng" })
  } catch (err: any) {
    console.error("Error deleting row:", err)
    res.status(500).json({ error: "Lỗi xóa dòng", message: err?.message })
  }
})

router.post("/query", adminOnly, async (req: Request, res: Response) => {
  try {
    const sql = (req.body?.sql ?? req.body?.query) as string | undefined
    if (!sql || typeof sql !== "string" || !sql.trim()) return res.status(400).json({ error: "SQL query là bắt buộc" })
    const trimmedSql = sql.trim().toUpperCase()
    if (!trimmedSql.startsWith("SELECT")) return res.status(400).json({ error: "Chỉ cho phép SELECT queries" })
    let finalSql = sql.trim()
    if (!finalSql.toUpperCase().includes("LIMIT")) finalSql += " LIMIT 1000"
    const result = await query(finalSql)
    res.json({ rows: result.rows, rowCount: result.rows.length, columns: result.rows.length > 0 ? Object.keys(result.rows[0]) : [] })
  } catch (err: any) {
    console.error("Error executing query:", err)
    res.status(500).json({ error: "Query Error", message: err.message, code: err.code })
  }
})

router.get("/connection-info", adminOnly, (req: Request, res: Response) => {
  try {
    const host = getBootstrapEnv("POSTGRES_HOST", "(not set)")
    const port = getBootstrapEnv("POSTGRES_PORT", "5432")
    const database = getBootstrapEnv("POSTGRES_DB", "(not set)")
    const user = getBootstrapEnv("POSTGRES_USER", "(not set)")
    const passwordSet = !!getBootstrapEnv("POSTGRES_PASSWORD")
    const ssl = getBootstrapEnv("POSTGRES_SSL") === "true"
    const connectionString = `postgresql://${user}:****@${host}:${port}/${database}${ssl ? "?sslmode=require" : ""}`
    res.json({ host, port, database, user, password: passwordSet ? "****" : "(not set)", ssl, connectionString })
  } catch (err: any) {
    res.status(500).json({ error: "Internal Server Error", message: err.message })
  }
})

router.get("/stats", adminOnly, async (req: Request, res: Response) => {
  try {
    const stats = await query(`
      SELECT 'users' as table_name, COUNT(*)::text as row_count FROM ai_portal.users
      UNION ALL SELECT 'chat_sessions', COUNT(*)::text FROM ai_portal.chat_sessions
      UNION ALL SELECT 'messages', COUNT(*)::text FROM ai_portal.messages
      UNION ALL SELECT 'message_attachments', COUNT(*)::text FROM ai_portal.message_attachments
      UNION ALL SELECT 'assistants', COUNT(*)::text FROM ai_portal.assistants
      UNION ALL SELECT 'projects', COUNT(*)::text FROM ai_portal.projects
      UNION ALL SELECT 'write_articles', COUNT(*)::text FROM ai_portal.write_articles
    `)
    res.json({ stats: stats.rows })
  } catch (err: any) {
    console.error("Error fetching stats:", err)
    res.status(500).json({ error: "Internal Server Error", message: allowAdmin ? err.message : undefined })
  }
})

export default router
