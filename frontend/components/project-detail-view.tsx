"use client"

import { FileIcon, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getProjectIcon } from "@/lib/project-icons"
import { useLanguage } from "@/contexts/language-context"
import type { Project } from "@/types"
import { getProjectFileUrl } from "@/lib/api/projects"

interface ProjectDetailViewProps {
  project: Project
}

/** Hiển thị thông tin dự án (read-only) và nút mở chỉnh sửa. */
export function ProjectDetailView({ project }: ProjectDetailViewProps) {
  const { t } = useLanguage()
  const name = project.name?.trim() || ""
  const description = project.description?.trim() || ""
  const tags = project.tags ?? []
  const teamMembers = project.team_members ?? []
  const fileKeys = project.file_keys ?? []
  const icon = (project.icon?.trim() || "FolderKanban") as string
  const IconComp = getProjectIcon(icon)

  const openEditDialog = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-edit-project", { detail: project }))
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
            <IconComp className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold truncate">{name || t("projectDetail.defaultName")}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={openEditDialog}
          title={t("projectDetail.editProject")}
        >
          <Pencil className="h-4 w-4" />
          {t("projectDetail.editProject")}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-2xl">
        <div className="space-y-6">
          {name && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("projectEdit.projectNameLabel")}</h2>
              <p className="text-sm text-foreground">{name}</p>
            </div>
          )}

          {description && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("projectEdit.descriptionLabel")}</h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">{description}</p>
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("projectDetail.tagLabel")}</h2>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {teamMembers.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("projectDetail.teamMembersLabel")}</h2>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((member, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm bg-primary/10 text-primary"
                  >
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}

          {fileKeys.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("projectEdit.fileAttachmentsLabel")}</h2>
              <ul className="space-y-2">
                {fileKeys.map((key, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">{key.split("/").pop() ?? key}</span>
                    </div>
                    <a
                      href={getProjectFileUrl(key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs shrink-0 hover:underline"
                    >
                      {t("projectEdit.download")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!name && !description && tags.length === 0 && teamMembers.length === 0 && fileKeys.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("projectDetail.noInfo")}</p>
          )}
        </div>
      </div>
    </div>
  )
}
