// app/page.tsx – Trang gốc: chuyển đến trang chào mừng (lần đầu) hoặc trợ lý main (sau khi đã xem welcome)
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/welcome")
}
