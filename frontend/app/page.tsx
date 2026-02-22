// app/page.tsx – Root page: middleware already handles /setup redirect when setup needed; otherwise go to welcome (giữ query error để welcome hiển thị)
import { redirect } from "next/navigation"

type SearchParams = { [key: string]: string | string[] | undefined }

export default function Home({ searchParams }: { searchParams?: SearchParams }) {
  const q = new URLSearchParams()
  const err = searchParams?.error
  if (err != null) q.set("error", Array.isArray(err) ? err[0] : err)
  redirect(`/welcome${q.toString() ? `?${q.toString()}` : ""}`)
}
