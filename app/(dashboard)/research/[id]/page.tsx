"use client"

import { useParams } from "next/navigation"
import { MainView } from "@/components/main-view"

export default function ResearchPage() {
  const params = useParams()
  const researchId = params.id as string

  // Mock research data - trong thực tế sẽ fetch từ API
  const research = {
    id: Number.parseInt(researchId),
    name: `Nghiên cứu ${researchId}`,
  }

  return <MainView researchContext={research} />
}
