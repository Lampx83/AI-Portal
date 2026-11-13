"use client"

import { useMemo, useRef, useState, type DragEvent } from "react"
import { Download, FileIcon, Folder, Pencil, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  deleteProjectFile,
  getProjectFileUrl,
  patchProjectFile,
  uploadProjectFilesDetailed,
} from "@/lib/api/projects"
import { displayWho, useTeamText } from "@/lib/team-text"
import type { Project, ProjectFileMeta } from "@/types"
import { cn } from "@/lib/utils"

function fmtSize(n: number): string {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  project: Project
  /** Chủ hoặc biên tập viên */
  canUpload: boolean
  currentEmail: string
  /** Gọi sau mỗi thao tác để cha tải lại dự án */
  onChanged: () => Promise<void> | void
}

export function ProjectFilesPanel({ project, canUpload, currentEmail, onChanged }: Props) {
  const tt = useTeamText()
  const { toast } = useToast()
  const projectId = String(project.id)
  const isOwner = project.my_role === "owner" || (!project.is_shared && !project.my_role)
  const keys = project.file_keys ?? []
  const meta = project.file_meta ?? {}
  const names = useMemo(() => {
    const m = new Map<string, string | null | undefined>()
    for (const x of project.members ?? []) m.set(x.email.toLowerCase(), x.display_name)
    if (project.owner_email) m.set(project.owner_email.toLowerCase(), project.owner_display_name)
    return m
  }, [project])

  const [folder, setFolder] = useState("")
  const [filter, setFilter] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editFolder, setEditFolder] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const folders = useMemo(() => {
    const s = new Set<string>()
    for (const k of keys) {
      const f = (meta[k] as ProjectFileMeta | undefined)?.folder
      if (f) s.add(f)
    }
    return Array.from(s).sort()
  }, [keys, meta])

  const rows = keys
    .map((k) => ({ key: k, m: meta[k] as ProjectFileMeta | undefined }))
    .filter((r) => filter === null || (r.m?.folder ?? "") === filter)
    .sort((a, b) => (b.m?.at ?? "").localeCompare(a.m?.at ?? ""))

  const upload = async (list: FileList | File[] | null) => {
    const files = list ? Array.from(list) : []
    if (!canUpload || files.length === 0) return
    setBusy(true)
    try {
      const done = await uploadProjectFilesDetailed(files, projectId, folder.trim())
      toast({ title: tt("files.uploaded", { n: done.length }) })
      await onChanged()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const canTouch = (m?: ProjectFileMeta) => isOwner || (canUpload && !!m?.by && m.by === currentEmail.toLowerCase())

  const saveEdit = async (key: string) => {
    try {
      await patchProjectFile(projectId, { key, name: editName, folder: editFolder })
      setEditing(null)
      toast({ title: tt("files.saved") })
      await onChanged()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error).message, variant: "destructive" })
    }
  }

  const remove = async (key: string, label: string) => {
    if (typeof window !== "undefined" && !window.confirm(tt("files.removeConfirm", { name: label }))) return
    try {
      await deleteProjectFile(projectId, key)
      toast({ title: tt("files.removed") })
      await onChanged()
    } catch (e) {
      toast({ title: "Lỗi", description: (e as Error).message, variant: "destructive" })
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDrag(false)
    void upload(e.dataTransfer.files)
  }

  return (
    <div className="grid gap-3" data-testid="project-files-panel">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{tt("files.title")}</h3>

      {canUpload ? (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              list="project-folder-list"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder={tt("files.folderPlaceholder")}
              className="h-8 w-64 text-sm"
              aria-label={tt("files.folder")}
            />
            <datalist id="project-folder-list">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors",
              drag ? "border-primary bg-primary/10" : "border-gray-300 hover:border-gray-400 dark:border-gray-600"
            )}
          >
            <Upload className="mb-2 h-7 w-7 text-gray-400" />
            <p className="text-sm font-medium">{busy ? tt("files.uploading") : tt("files.upload")}</p>
            <p className="text-xs text-muted-foreground">{tt("files.uploadHint")}</p>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {tt("files.viewerNote")}
        </p>
      )}

      {folders.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[null, ...folders].map((f) => (
            <button
              key={f ?? "__all"}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs",
                filter === f ? "border-primary bg-primary/10 text-primary" : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300"
              )}
            >
              {f === null ? tt("files.folderAll") : f}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">{tt("files.empty")}</p>
      ) : (
        <ul className="grid gap-1.5">
          {rows.map(({ key, m }) => {
            const label = m?.name ?? tt("files.legacy")
            const isEditing = editing === key
            return (
              <li key={key} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 min-w-[180px] flex-1 text-sm" aria-label="Tên tệp" />
                    <Input value={editFolder} list="project-folder-list" onChange={(e) => setEditFolder(e.target.value)} placeholder={tt("files.folderPlaceholder")} className="h-8 w-48 text-sm" aria-label={tt("files.folder")} />
                    <Button type="button" size="sm" className="h-8" onClick={() => void saveEdit(key)}>{tt("files.save")}</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(null)}>{tt("files.cancel")}</Button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={label}>{label}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {m?.folder && <span className="inline-flex items-center gap-1"><Folder className="h-3 w-3" aria-hidden="true" />{m.folder}</span>}
                        {m?.by && <span>{tt("files.by", { who: displayWho(m.by, names) })}</span>}
                        {m?.at && <span>{new Date(m.at).toLocaleDateString("vi-VN")}</span>}
                        {m?.size ? <span>{fmtSize(m.size)}</span> : null}
                      </div>
                    </div>
                    <a href={getProjectFileUrl(key)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" aria-label={`${tt("files.download")}: ${label}`}>
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {tt("files.download")}
                    </a>
                    {canTouch(m) && (
                      <>
                        <button
                          type="button"
                          title={tt("files.rename")}
                          aria-label={`${tt("files.rename")}: ${label}`}
                          onClick={() => {
                            setEditing(key)
                            setEditName(m?.name ?? "")
                            setEditFolder(m?.folder ?? "")
                          }}
                          className="rounded p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title={tt("files.remove")}
                          aria-label={`${tt("files.remove")}: ${label}`}
                          onClick={() => void remove(key, label)}
                          className="rounded p-1 text-gray-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
