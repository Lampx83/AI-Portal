"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  getDbTables,
  getDbTable,
  getDbConnectionInfo,
  postDbQuery,
  postDbRow,
  putDbRow,
  deleteDbRow,
  type DbTableSchemaCol,
} from "@/lib/api/admin"

type TableMeta = { table_schema: string; table_name: string; column_count: number }

export function DatabaseTab() {
  const [tables, setTables] = useState<TableMeta[]>([])
  const [loadingTables, setLoadingTables] = useState(true)
  const [connInfo, setConnInfo] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<{
    table: string
    schema: DbTableSchemaCol[]
    primary_key: string[]
    data: Record<string, unknown>[]
    pagination: { total: number }
  } | null>(null)
  const [loadingTable, setLoadingTable] = useState(false)
  const [query, setQuery] = useState("SELECT * FROM research_chat.users LIMIT 10;")
  const [queryResult, setQueryResult] = useState<{ rows: unknown[]; columns: { name: string }[] } | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [rowModalOpen, setRowModalOpen] = useState(false)
  const [rowMode, setRowMode] = useState<"add" | "edit">("add")
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null)
  const [rowForm, setRowForm] = useState<Record<string, string>>({})

  const loadTables = () => {
    setLoadingTables(true)
    getDbTables()
      .then((d) => setTables(d.tables || []))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false))
  }

  const loadConnInfo = () => {
    getDbConnectionInfo()
      .then((d) => setConnInfo(d.connectionString || null))
      .catch(() => setConnInfo(null))
  }

  useEffect(() => {
    loadTables()
    loadConnInfo()
  }, [])

  const loadTableData = (tableName: string) => {
    setSelectedTable(tableName)
    setLoadingTable(true)
    setTableData(null)
    getDbTable(tableName, 100, 0)
      .then((d) =>
        setTableData({
          table: d.table,
          schema: d.schema,
          primary_key: d.primary_key,
          data: d.data,
          pagination: d.pagination,
        })
      )
      .catch(() => setTableData(null))
      .finally(() => setLoadingTable(false))
  }

  const executeQuery = () => {
    setQueryError(null)
    setQueryResult(null)
    postDbQuery({ query: query.trim() })
      .then((d) => setQueryResult({ rows: d.rows || [], columns: d.columns || [] }))
      .catch((e) => setQueryError((e as Error)?.message || "Lỗi"))
  }

  const openAddRow = () => {
    if (!tableData) return
    setRowMode("add")
    setEditRow(null)
    const initial: Record<string, string> = {}
    tableData.schema.forEach((col) => {
      initial[col.column_name] = ""
    })
    setRowForm(initial)
    setRowModalOpen(true)
  }

  const openEditRow = (row: Record<string, unknown>) => {
    if (!tableData) return
    setRowMode("edit")
    setEditRow(row)
    const initial: Record<string, string> = {}
    tableData.schema.forEach((col) => {
      const v = row[col.column_name]
      initial[col.column_name] = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)
    })
    setRowForm(initial)
    setRowModalOpen(true)
  }

  const submitRow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tableData || !selectedTable) return
    const pkSet = new Set(tableData.primary_key)
    const row: Record<string, unknown> = {}
    tableData.schema.forEach((col) => {
      const raw = rowForm[col.column_name]?.trim() ?? ""
      if (rowMode === "add" && col.column_default && raw === "") return
      if (col.is_nullable === "YES" && raw === "") {
        row[col.column_name] = null
        return
      }
      if (raw === "") {
        row[col.column_name] = ""
        return
      }
      if (col.data_type === "integer" || col.data_type === "bigint" || col.data_type === "smallint") {
        row[col.column_name] = parseInt(raw, 10)
      } else if (col.data_type === "boolean") {
        row[col.column_name] = raw === "true" || raw === "t" || raw === "1"
      } else if (col.data_type === "uuid" && /^[0-9a-f-]{36}$/i.test(raw)) {
        row[col.column_name] = raw
      } else {
        row[col.column_name] = raw
      }
    })
    try {
      if (rowMode === "add") {
        await postDbRow(selectedTable, row)
        alert("Đã thêm dòng")
      } else if (editRow) {
        const pk: Record<string, unknown> = {}
        tableData.primary_key.forEach((k) => (pk[k] = editRow[k]))
        await putDbRow(selectedTable, pk, row)
        alert("Đã cập nhật dòng")
      }
      setRowModalOpen(false)
      loadTableData(selectedTable)
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  const deleteRow = async (row: Record<string, unknown>) => {
    if (!tableData || !selectedTable || !confirm("Bạn có chắc muốn xóa dòng này?")) return
    const pk: Record<string, unknown> = {}
    tableData.primary_key.forEach((k) => (pk[k] = row[k]))
    try {
      await deleteDbRow(selectedTable, pk)
      loadTableData(selectedTable)
    } catch (e) {
      alert((e as Error)?.message || "Lỗi")
    }
  }

  const formatVal = (v: unknown) => {
    if (v == null) return "—"
    if (typeof v === "object") return JSON.stringify(v)
    return String(v)
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Quản trị Database</h2>
      {connInfo != null && (
        <div className="mb-4 p-3 bg-muted/50 rounded-md">
          <h3 className="text-sm font-semibold mb-2">Thông tin kết nối PostgreSQL</h3>
          <pre className="text-xs overflow-x-auto">{connInfo}</pre>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {loadingTables ? (
          <p className="text-muted-foreground">Đang tải danh sách tables...</p>
        ) : (
          tables.map((t) => (
            <Card
              key={t.table_schema + "." + t.table_name}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => loadTableData(t.table_name)}
            >
              <CardContent className="p-4">
                <h3 className="font-semibold">{t.table_name}</h3>
                <p className="text-xs text-muted-foreground">
                  Schema: {t.table_schema} • Columns: {t.column_count}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {selectedTable && (
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
            <h3 className="font-semibold">
              {selectedTable} {tableData != null ? `(${tableData.pagination.total} rows)` : ""}
            </h3>
            {tableData != null && tableData.primary_key.length > 0 && (
              <Button size="sm" onClick={openAddRow}>
                + Thêm dòng
              </Button>
            )}
          </div>
          {loadingTable ? (
            <p className="text-muted-foreground">Đang tải dữ liệu...</p>
          ) : tableData ? (
            <div className="border rounded-md overflow-auto max-h-[560px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableData.schema.map((c) => (
                      <TableHead key={c.column_name}>{c.column_name}</TableHead>
                    ))}
                    {tableData.primary_key.length > 0 && (
                      <TableHead className="w-[140px]">Thao tác</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tableData.schema.length + 1} className="text-center text-muted-foreground">
                        Chưa có dữ liệu. Bấm &quot;Thêm dòng&quot; để thêm.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.data.map((row, idx) => (
                      <TableRow key={idx}>
                        {tableData.schema.map((c) => (
                          <TableCell key={c.column_name}>{formatVal(row[c.column_name])}</TableCell>
                        ))}
                        {tableData.primary_key.length > 0 && (
                          <TableCell>
                            <Button variant="secondary" size="sm" className="mr-1" onClick={() => openEditRow(row)}>
                              Sửa
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteRow(row)}>
                              Xóa
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-destructive">Lỗi tải bảng</p>
          )}
        </div>
      )}

      <h3 className="text-base font-semibold mb-2">SQL Query</h3>
      <div className="mb-2">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT * FROM research_chat.users LIMIT 10;"
          className="min-h-[120px] font-mono text-sm"
        />
        <Button className="mt-2" onClick={executeQuery}>
          Thực thi Query
        </Button>
      </div>
      {queryError && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-red-800 dark:text-red-200 text-sm">
          {queryError}
        </div>
      )}
      {queryResult != null && (
        <div className="border rounded-md overflow-auto max-h-[400px] mt-2">
          <Table>
            <TableHeader>
              <TableRow>
                {queryResult.columns.map((c) => (
                  <TableHead key={c.name}>{c.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(queryResult.rows as Record<string, unknown>[]).map((row, i) => (
                <TableRow key={i}>
                  {queryResult.columns.map((col) => (
                    <TableCell key={col.name}>{formatVal(row[col.name])}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={rowModalOpen} onOpenChange={setRowModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rowMode === "add" ? `Thêm dòng vào ${selectedTable}` : `Sửa dòng trong ${selectedTable}`}
            </DialogTitle>
          </DialogHeader>
          {tableData && (
            <form onSubmit={submitRow} className="space-y-4">
              {tableData.schema.map((col) => {
                const isPk = tableData.primary_key.includes(col.column_name)
                const readOnly = rowMode === "edit" && isPk
                return (
                  <div key={col.column_name}>
                    <Label>
                      {col.column_name}
                      {isPk ? " (PK)" : ""}
                      {col.column_default && rowMode === "add" ? " (có thể để trống)" : ""}
                    </Label>
                    <Input
                      value={rowForm[col.column_name] ?? ""}
                      onChange={(e) => setRowForm((f) => ({ ...f, [col.column_name]: e.target.value }))}
                      readOnly={readOnly}
                      className={readOnly ? "bg-muted" : ""}
                    />
                  </div>
                )
              })}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRowModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit">Lưu</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
