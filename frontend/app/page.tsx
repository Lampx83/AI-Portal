// app/page.tsx – Trang gốc: middleware đã xử lý redirect /setup khi cần cài đặt; còn lại chuyển đến welcome
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/welcome")
}
