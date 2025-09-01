// app/assistants/[alias]/assistant-page-impl.tsx
"use client"
import { useSearchParams } from "next/navigation"
// ... các import khác như trước

export default function AssistantPageWithSidKey() {
    const sp = useSearchParams()
    const sid = sp.get("sid") || "no-sid"

    // DÙNG sid LÀM key ⇒ component remount mỗi lần sid đổi
    return <AssistantPageImpl key={sid} />
}
