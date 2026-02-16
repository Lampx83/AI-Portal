"use client"

import { useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FolderKanban, Plus, Users } from "lucide-react"
import { getProjectIcon } from "@/lib/project-icons"
import { useLanguage } from "@/contexts/language-context"
import type { Project } from "@/types"

interface ProjectsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  projects: Project[]
  onSelect: (project: Project) => void
  onAdd: () => void
  onEdit?: (project: Project) => void
  activeProjectId?: string | null
}

export function ProjectsDialog({
  isOpen,
  onOpenChange,
  projects,
  onSelect,
  onAdd,
  onEdit,
  activeProjectId = null,
}: ProjectsDialogProps) {
  const { t } = useLanguage()
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const aTime = a.updated_at || a.created_at || ""
      const bTime = b.updated_at || b.created_at || ""
      if (aTime > bTime) return -1
      if (aTime < bTime) return 1
      return String(a.id).localeCompare(String(b.id))
    })
  }, [projects])

  const handleProjectClick = (project: Project) => {
    onSelect(project)
    onOpenChange(false)
  }

  const handleAddClick = () => {
    onAdd()
    onOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
            <FolderKanban className="w-5 h-5" />
            {t("projects.myProjects")}
          </DialogTitle>
          <DialogDescription>
            {t("projects.selectOrCreate")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sortedProjects.map((project) => {
              const isActive = activeProjectId != null && String(project.id) === String(activeProjectId)
              const IconComp = getProjectIcon(project.icon)
              return (
                <Button
                  key={String(project.id)}
                  variant="outline"
                  className={`h-auto flex flex-col items-center justify-center gap-2 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border transition-all duration-200 rounded-xl shadow-sm hover:shadow-md min-h-[100px] ${
                    isActive
                      ? "border-blue-300 dark:border-blue-700 ring-2 ring-blue-200 dark:ring-blue-800"
                      : "border-gray-200 dark:border-gray-700 hover:bg-white/80 dark:hover:bg-gray-800/80"
                  }`}
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center shadow-sm">
                    <IconComp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300 line-clamp-2 w-full">
                    {project.name}
                  </span>
                  {project.is_shared && (project.owner_display_name || project.owner_email) && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-0.5 truncate w-full justify-center">
                      <Users className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{project.owner_display_name || project.owner_email}</span>
                    </span>
                  )}
                </Button>
              )
            })}
            <Button
              variant="outline"
              className="h-auto min-h-[100px] flex flex-col items-center justify-center gap-2 text-center p-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200 rounded-xl shadow-sm hover:shadow-md"
              onClick={handleAddClick}
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-sm">
                <Plus className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </div>
              <span className="text-sm font-medium leading-tight text-gray-700 dark:text-gray-300">{t("projects.addProject")}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
