"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RawDataRow } from "./types"

/** Bảng dữ liệu với phân trang - dùng cho modal xem dữ liệu (đơn sheet hoặc từng sheet) */
export function SheetDataTable({
  data,
  pageSize,
  dataPage: controlledPage,
  setDataPage: setControlledPage,
}: {
  data: RawDataRow[]
  pageSize: number
  dataPage?: number
  setDataPage?: (p: number | ((prev: number) => number)) => void
}) {
  const [internalPage, setInternalPage] = useState(1)
  const isControlled = controlledPage !== undefined && setControlledPage !== undefined
  const page = isControlled ? controlledPage : internalPage
  const setPage = isControlled ? setControlledPage! : setInternalPage
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))
  const slice = data.slice((page - 1) * pageSize, page * pageSize)
  if (data.length === 0) {
    return <div className="p-8 text-center text-slate-500">Không có dữ liệu</div>
  }
  const cols = Object.keys(data[0]!)
  return (
    <>
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-gray-800 sticky top-0">
            <tr>
              {cols.map((key) => (
                <th key={key} className="px-4 py-2 text-left font-medium border-b">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, i) => (
              <tr
                key={(page - 1) * pageSize + i}
                className="border-b hover:bg-slate-50 dark:hover:bg-gray-800/50"
              >
                {cols.map((key) => (
                  <td key={key} className="px-4 py-2">
                    {String(row[key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-t bg-slate-50 dark:bg-gray-800/50 text-sm flex-shrink-0">
        <span className="text-slate-600 dark:text-gray-400">
          Hiển thị {(page - 1) * pageSize + 1}–
          {Math.min(page * pageSize, data.length)} / {data.length} bản ghi
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={page <= 1}
            onClick={() => setPage((p: number) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[6rem] text-center tabular-nums">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={page >= totalPages}
            onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
