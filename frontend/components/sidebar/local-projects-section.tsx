"use client"

import { useCallback, useEffect, useState } from "react"
import { FolderOpen, HardDrive, Plus, FolderCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTip } from "@/components/ui/info-tip"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"

type LocalProject = { id: string; name: string; description: string; folder: string; createdAt: string; updatedAt: string }

type NeuDesktopApi = {
  isDesktop: boolean
  platform: string
  getWorkspace: () => Promise<{ dir: string; portalUrl: string }>
  chooseWorkspace: () => Promise<string | null>
  listProjects: () => Promise<LocalProject[]>
  createProject: (name: string, description: string) => Promise<LocalProject>
  revealProject: (folder: string) => Promise<string>
}

function getDesktopApi(): NeuDesktopApi | null {
  if (typeof window === "undefined") return null
  const api = (window as unknown as { neuDesktop?: NeuDesktopApi }).neuDesktop
  return api && api.isDesktop ? api : null
}

/** Chỉ hiện trong ứng dụng NEU-Research Desktop: dự án được lưu thành thư mục trên máy người dùng. */
export default function LocalProjectsSection() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [api, setApi] = useState<NeuDesktopApi | null>(null)
  const [projects, setProjects] = useState<LocalProject[]>([])
  const [dir, setDir] = useState("")
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async (a: NeuDesktopApi) => {
    try {
      const [ws, list] = await Promise.all([a.getWorkspace(), a.listProjects()])
      setDir(ws.dir)
      setProjects(list)
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" })
    }
  }, [t, toast])

  useEffect(() => {
    const a = getDesktopApi()
    setApi(a)
    if (a) void refresh(a)
  }, [refresh])

  if (!api) return null

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const p = await api.createProject(name.trim(), desc.trim())
      setOpen(false)
      setName("")
      setDesc("")
      toast({ title: t("desktop.created").replace("{name}", p.name) })
      await refresh(api)
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error)?.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-2">
      <div className="rounded-xl p-4 border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 shadow-sm">
        <div className="flex justify-between items-center mb-3 select-none">
          <div className="flex-1 flex items-center min-w-0">
            <HardDrive className="w-4 h-4 mr-2 flex-shrink-0 text-emerald-700 dark:text-emerald-300" />
            <h3 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider truncate">
              {t("desktop.localProjects")}
            </h3>
            <InfoTip text={t("desktop.localProjectsTip").replace("{dir}", dir)} className="ml-1.5" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 text-emerald-700 dark:text-emerald-300"
            onClick={() => setOpen(true)}
            title={t("desktop.newLocalProject")}
            aria-label={t("desktop.newLocalProject")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">{t("desktop.noLocalProjects")}</p>
        ) : (
          <ul className="space-y-1">
            {projects.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => api.revealProject(p.folder).catch((e) => toast({ title: t("common.error"), description: String(e?.message ?? e), variant: "destructive" }))}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/70 dark:hover:bg-gray-700/50 transition-colors"
                  title={`${t("desktop.openFolder")}: ${p.folder}`}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={async () => {
            const d = await api.chooseWorkspace()
            if (d) await refresh(api)
          }}
          className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <FolderCog className="h-3.5 w-3.5" />
          {t("desktop.changeFolder")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("desktop.newLocalProject")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lp-name">{t("desktop.projectName")}</Label>
              <Input id="lp-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-desc">{t("desktop.projectDesc")}</Label>
              <Input id="lp-desc" value={desc} maxLength={2000} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">{t("desktop.saveLocation").replace("{dir}", dir)}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={create} disabled={busy || !name.trim()}>{t("desktop.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
