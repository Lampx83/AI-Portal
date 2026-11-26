"use client"

import { useEffect, useMemo, useState } from "react"
import { getProjectActivity, type ProjectActivityRow } from "@/lib/api/projects"
import { displayWho, useTeamText, type TeamKey } from "@/lib/team-text"
import type { ProjectMember } from "@/types"

const STATUS_VI: Record<string, string> = { todo: "chưa bắt đầu", doing: "đang thực hiện", done: "đã xong" }

export function ProjectActivityPanel({ projectId, members, ownerEmail, ownerName, version }: { projectId: string; members: ProjectMember[]; ownerEmail?: string | null; ownerName?: string | null; version?: number }) {
  const tt = useTeamText()
  const [rows, setRows] = useState<ProjectActivityRow[] | null>(null)
  const [err, setErr] = useState("")
  useEffect(() => {
    let off = false
    getProjectActivity(projectId)
      .then((r) => !off && setRows(r))
      .catch((e) => !off && setErr((e as Error).message))
    return () => {
      off = true
    }
  }, [projectId, version])
  const names = useMemo(() => {
    const m = new Map<string, string | null | undefined>()
    for (const x of members) m.set(x.email.toLowerCase(), x.display_name)
    if (ownerEmail) m.set(ownerEmail.toLowerCase(), ownerName)
    return m
  }, [members, ownerEmail, ownerName])

  const line = (r: ProjectActivityRow): string => {
    const d = r.detail ?? {}
    const key = `activity.${r.kind}` as TeamKey
    const roleLabel = (v: unknown) => tt(v === "editor" ? "members.editor" : "members.viewer")
    return tt(key, {
      who: displayWho(r.actor_email, names),
      email: String(d.email ?? ""),
      role: roleLabel(d.role),
      names: Array.isArray(d.names) ? (d.names as string[]).join(", ") + (Number(d.count) > (d.names as string[]).length ? "…" : "") : "",
      name: String(d.name ?? ""),
      stage: String(d.stage ?? ""),
      status: STATUS_VI[String(d.status)] ?? String(d.status ?? ""),
      text: String(d.text ?? ""),
      assignee: displayWho(String(d.assignee ?? ""), names),
    })
  }

  return (
    <div className="grid gap-3" data-testid="project-activity-panel">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{tt("activity.title")}</h3>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">{tt("activity.empty")}</p>}
      <ul className="grid gap-1.5">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="flex items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60">
            <span className="mt-0.5 w-28 shrink-0 text-xs tabular-nums text-muted-foreground">{new Date(r.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>
            <span className="min-w-0 break-words">{line(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
