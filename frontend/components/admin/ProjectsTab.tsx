"use client"

import { useEffect, useState } from "react"
import { FolderOpen, Copy, Check, ExternalLink, Users, FileText } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAdminProjects, type AdminProjectRow } from "@/lib/api/admin"
import { API_CONFIG } from "@/lib/config"

function getUserApiUrl(email: string): string {
  const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
  return `${base}/api/users/email/${encodeURIComponent(email)}`
}

function getProjectApiUrl(projectId: string): string {
  const base = API_CONFIG.baseUrl.replace(/\/+$/, "")
  return `${base}/api/projects/${projectId}`
}


export function ProjectsTab() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<AdminProjectRow[]>([])
  const [filterEmail, setFilterEmail] = useState("")
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url)
    setCopiedUrl(url)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  const load = () => {
    setLoading(true)
    setError(null)
    getAdminProjects()
      .then((res) => setProjects(res.projects ?? []))
      .catch((e) => setError(e?.message || "Lỗi tải projects"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filteredProjects = filterEmail.trim()
    ? projects.filter((p) =>
        (p.user_email ?? "").toLowerCase().includes(filterEmail.toLowerCase())
      )
    : projects

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString("vi-VN") : "—"

  if (loading) {
    return <p className="text-muted-foreground py-8 text-center">Đang tải...</p>
  }
  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
        {error}
      </div>
    )
  }

  return (
    <>
      <h2 className="text-lg font-semibold mb-2">Quản lý Projects (Dự án của tôi)</h2>
      <p className="text-muted-foreground text-sm mb-4">
        Danh sách tất cả dự án do người dùng tạo. Mỗi project thuộc về một user, có thể có thành viên team và file đính kèm.
      </p>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Lọc theo email user..."
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
            className="w-64 h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          Làm mới
        </Button>
      </div>
      <div className="border rounded-md overflow-auto max-h-[520px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên project</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead>Chủ sở hữu (email)</TableHead>
              <TableHead className="text-center w-20">Thành viên</TableHead>
              <TableHead className="text-center w-20">File</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead>API Project</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Chưa có project nào.
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                      <a
                        href={`/project/${p.id}`}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.name || "—"}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground" title={p.description ?? ""}>
                    {p.description || "—"}
                  </TableCell>
                  <TableCell>
                    <a
                      href={getUserApiUrl(p.user_email)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      {p.user_email}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Users className="h-3.5 w-3.5" />
                      {(p.team_members ?? []).length}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-sm">
                      <FileText className="h-3.5 w-3.5" />
                      {(p.file_keys ?? []).length}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <code className="text-xs truncate max-w-[140px]" title={getProjectApiUrl(p.id)}>
                        /api/projects/{p.id.slice(0, 8)}…
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => copyUrl(getProjectApiUrl(p.id))}
                        title="Sao chép link API project"
                      >
                        {copiedUrl === getProjectApiUrl(p.id) ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <a
                        href={getProjectApiUrl(p.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title="Mở API project"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
