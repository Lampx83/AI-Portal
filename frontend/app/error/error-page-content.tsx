"use client"

import { RefreshCw, AlertTriangle, LifeBuoy } from "lucide-react"

const SUPPORT_EMAIL = "lampx@neu.edu.vn"

export function ErrorPageContent({ reason }: { reason?: string | null }) {
  // reason không dùng nữa: mọi lỗi kết nối đều hiển thị chung thông báo "quá tải".
  void reason

  // Nút Tải lại đưa người dùng về trang gốc (vd. /tuyen-sinh) để middleware
  // kiểm tra lại backend, thay vì reload /error (sẽ đứng yên).
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const rootHref = basePath ? `${basePath}/` : "/"

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-4 bg-gradient-to-b from-amber-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      {/* Vệt sáng trang trí phía trên */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(680px 340px at 50% 0%, rgba(251,191,36,0.20), transparent 70%)",
        }}
      />
      {/* Đốm mờ trang trí */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-500/10" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-rose-200/25 blur-3xl dark:bg-rose-500/10" />

      <div className="relative w-full max-w-lg rounded-3xl border border-amber-200/70 bg-white/90 shadow-xl shadow-amber-100/60 backdrop-blur-sm dark:border-amber-800/40 dark:bg-slate-900/80 dark:shadow-black/30">
        <div className="flex flex-col items-center gap-7 px-8 py-11 text-center sm:px-12 sm:py-12">
          {/* Icon cảnh báo + vòng nhịp */}
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-20 w-20 rounded-full bg-amber-300/40 animate-ping" />
            <div className="relative rounded-full bg-amber-100 p-4 ring-8 ring-amber-50 dark:bg-amber-900/40 dark:ring-amber-900/10">
              <AlertTriangle className="h-9 w-9 text-amber-500" />
            </div>
          </div>

          {/* Thông báo: 2 dòng, nổi bật */}
          <div className="w-full rounded-2xl border border-amber-200 bg-amber-50/80 px-6 py-6 dark:border-amber-800/50 dark:bg-amber-900/15">
            <p className="text-xl font-bold leading-relaxed text-amber-800 dark:text-amber-300 sm:text-2xl">
              Hệ thống đang quá tải,
              <br />
              vui lòng quay trở lại sau
            </p>
          </div>

          {/* Nút hành động */}
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <a
              href={rootHref}
              className="group inline-flex items-center gap-2.5 rounded-xl bg-amber-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-600 hover:shadow-amber-500/45 active:scale-[0.98]"
            >
              <RefreshCw className="h-5 w-5 transition-transform duration-500 group-hover:rotate-180" />
              Tải lại
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2.5 rounded-xl border border-amber-300 bg-white/70 px-8 py-3.5 text-base font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-800/60 dark:bg-slate-900/40 dark:text-amber-300 dark:hover:bg-amber-900/20"
            >
              <LifeBuoy className="h-5 w-5" />
              Liên hệ hỗ trợ
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
