export const metadata = {
  title: "Trang chủ nghiên cứu",
  description: "Trang hiển thị giao diện chính của hệ thống hỗ trợ nghiên cứu",
}

"use client"

import { MainView } from "@/components/main-view"

export default function HomePage() {
  return <MainView researchContext={null} />
}
