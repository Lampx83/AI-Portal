"use client"

import { useEffect, useState, useMemo } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [filterText, setFilterText] = useState("")

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

  useEffect(() => {
    if (tables.length > 0 && selectedTable === null) {
      loadTableData(tables[0].table_name)
    }
  }, [tables.length])

  const loadTableData = (tableName: string) => {
    setSelectedTable(tableName)
    setSortColumn(null)
    setFilterText("")
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

  const displayedData = useMemo(() => {
    if (!tableData) return []
    let rows = tableData.data
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase()
      rows = rows.filter((row) =>
        tableData.schema.some((c) => {
          const v = formatVal(row[c.column_name])
          return v.toLowerCase().includes(q)
        })
      )
    }
    if (sortColumn != null && tableData.schema.some((c) => c.column_name === sortColumn)) {
      rows = [...rows].sort((a, b) => {
        const va = a[sortColumn]
        const vb = b[sortColumn]
        const aNull = va == null
        const bNull = vb == null
        if (aNull && bNull) return 0
        if (aNull) return sortDirection === "asc" ? 1 : -1
        if (bNull) return sortDirection === "asc" ? -1 : 1
        const sa = typeof va === "object" ? JSON.stringify(va) : String(va)
        const sb = typeof vb === "object" ? JSON.stringify(vb) : String(vb)
        const numA = Number(va)
        const numB = Number(vb)
        if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
          return sortDirection === "asc" ? numA - numB : numB - numA
        }
        const cmp = sa.localeCompare(sb, undefined, { numeric: true })
        return sortDirection === "asc" ? cmp : -cmp
      })
    }
    return rows
  }, [tableData, filterText, sortColumn, sortDirection])

  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(columnName)
      setSortDirection("asc")
    }
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Quản trị Database</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Danh mục Khoa/Viện (dùng trong hồ sơ người dùng): bảng <code className="bg-muted px-1 rounded">research_chat.faculties</code>. Chọn bảng bên dưới để xem/sửa dữ liệu.
      </p>
      {connInfo != null && (
        <div className="mb-4 p-3 bg-muted/50 rounded-md">
          <h3 className="text-sm font-semibold mb-2">Thông tin kết nối PostgreSQL</h3>
          <pre className="text-xs overflow-x-auto">{connInfo}</pre>
        </div>
      )}

      {loadingTables ? (
        <p className="text-muted-foreground mb-4">Đang tải danh sách bảng...</p>
      ) : (
        <Tabs
          value={selectedTable ?? tables[0]?.table_name ?? ""}
          onValueChange={(v) => loadTableData(v)}
          className="mb-6"
        >
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50">
            {tables.map((t) => (
              <TabsTrigger key={t.table_schema + "." + t.table_name} value={t.table_name} className="normal-case">
                {t.table_name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tables.map((t) => (
            <TabsContent key={t.table_name} value={t.table_name} className="mt-3">
              {selectedTable === t.table_name && (
                <div>
                  <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                    <span className="text-sm text-muted-foreground">
                      {tableData != null ? `${tableData.pagination.total} dòng` : ""}
                      {tableData != null && filterText.trim() ? ` (hiển thị ${displayedData.length})` : ""}
                    </span>
                    {tableData != null && tableData.primary_key.length > 0 && (
                      <Button size="sm" onClick={openAddRow}>
                        + Thêm dòng
                      </Button>
                    )}
                  </div>
                  {tableData != null && (
                    <div className="relative mb-2 max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Lọc theo nội dung ô..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  )}
                  {loadingTable ? (
                    <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                  ) : tableData ? (
                    <div className="border rounded-md overflow-auto max-h-[560px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {tableData.schema.map((c) => (
                              <TableHead key={c.column_name}>
                                <button
                                  type="button"
                                  onClick={() => handleSort(c.column_name)}
                                  className="inline-flex items-center gap-1 hover:text-foreground font-medium"
                                >
                                  {c.column_name}
                                  {sortColumn === c.column_name ? (
                                    sortDirection === "asc" ? (
                                      <ArrowUp className="h-3.5 w-3.5" />
                                    ) : (
                                      <ArrowDown className="h-3.5 w-3.5" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                                  )}
                                </button>
                              </TableHead>
                            ))}
                            {tableData.primary_key.length > 0 && (
                              <TableHead className="w-[140px]">Thao tác</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedData.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={tableData.schema.length + 1} className="text-center text-muted-foreground">
                                {tableData.data.length === 0
                                  ? "Chưa có dữ liệu. Bấm \"Thêm dòng\" để thêm."
                                  : "Không có dòng nào khớp bộ lọc."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            displayedData.map((row, idx) => (
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
            </TabsContent>
          ))}
        </Tabs>
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
                <TableRow key={`row-${i}`}>
                  {queryResult.columns.map((col, colIdx) => (
                    <TableCell key={colIdx}>{formatVal(row[col.name])}</TableCell>
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
