"use client"

import { ProjectCenterView } from "@/components/project-center-view"
import type { Project } from "@/types"

const DEMO_PROJECT = {
  id: "00000000-0000-4000-8000-00000000d351",
  name: "Ứng dụng AI trong học tập của sinh viên",
  icon: "FolderKanban",
} as unknown as Project

export default function DesktopFolderHarness() {
  return (
    <div className="min-h-screen flex bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <ProjectCenterView project={DEMO_PROJECT} />
    </div>
  )
}
