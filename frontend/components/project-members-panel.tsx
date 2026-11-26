"use client"

import { useState } from "react"
import { Crown, Mail, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTeamText } from "@/lib/team-text"

export interface MemberDraft {
  email: string
  role: "editor" | "viewer"
  display_name?: string | null
  has_account?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SELECT_CLS =
  "h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"

interface Props {
  ownerLabel: string
  ownerEmail?: string | null
  members: MemberDraft[]
  onChange: (next: MemberDraft[]) => void
  /** Chỉ chủ dự án được sửa */
  canManage: boolean
}

export function ProjectMembersPanel({ ownerLabel, ownerEmail, members, onChange, canManage }: Props) {
  const tt = useTeamText()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"editor" | "viewer">("editor")
  const [error, setError] = useState("")

  const add = () => {
    const e = email.trim().toLowerCase()
    if (!e) return
    if (!EMAIL_RE.test(e)) return setError(tt("members.bad"))
    if (members.some((m) => m.email === e) || e === (ownerEmail ?? "").toLowerCase()) return setError(tt("members.dup"))
    setError("")
    onChange([...members, { email: e, role, has_account: undefined }])
    setEmail("")
  }

  return (
    <div className="grid gap-4" data-testid="project-members-panel">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{tt("members.title")}</h3>
        <p className="text-xs text-muted-foreground">{tt("members.help")}</p>
      </div>
      {!canManage && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {tt("members.ownerOnly")}
        </p>
      )}
      <ul className="grid gap-1.5">
        <li className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
          <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{ownerLabel}</div>
            {ownerEmail && <div className="truncate text-xs text-muted-foreground">{ownerEmail}</div>}
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {tt("members.owner")}
          </span>
        </li>
        {members.map((m) => (
          <li key={m.email} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
            <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{m.display_name || m.email}</div>
              {m.display_name && <div className="truncate text-xs text-muted-foreground">{m.email}</div>}
            </div>
            {m.has_account === false && (
              <span title={tt("members.pendingHint")} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {tt("members.pending")}
              </span>
            )}
            <select
              value={m.role}
              disabled={!canManage}
              aria-label={tt("members.roleOf", { name: m.display_name || m.email })}
              onChange={(e) => onChange(members.map((x) => (x.email === m.email ? { ...x, role: e.target.value as "editor" | "viewer" } : x)))}
              className={SELECT_CLS}
            >
              <option value="editor">{tt("members.editor")}</option>
              <option value="viewer">{tt("members.viewer")}</option>
            </select>
            {canManage && (
              <button
                type="button"
                onClick={() => onChange(members.filter((x) => x.email !== m.email))}
                aria-label={tt("members.remove", { name: m.display_name || m.email })}
                className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {members.length === 0 && <li className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">{tt("members.none")}</li>}
      </ul>
      {canManage && (
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError("")
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder={tt("members.emailPlaceholder")}
              className="h-8 min-w-[220px] flex-1 text-sm"
              inputMode="email"
            />
            <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className={SELECT_CLS} aria-label={tt("members.roleOf", { name: email || "—" })}>
              <option value="editor">{tt("members.editor")}</option>
              <option value="viewer">{tt("members.viewer")}</option>
            </select>
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={add} disabled={!email.trim()}>
              {tt("members.add")}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
