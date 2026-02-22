// app/page.tsx – Root page: middleware already handles /setup redirect when setup needed; otherwise go to welcome
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/welcome")
}
