"use client"

import { LifeBuoy, RefreshCw } from "lucide-react"

// Đổi link này sang kênh hỗ trợ thật (email / fanpage / hotline) nếu cần.
const SUPPORT_URL = "https://www.neu.edu.vn"

export function ErrorPageContent({ reason }: { reason?: string | null }) {
  // reason không dùng nữa: mọi lỗi kết nối đều hiển thị chung một trang bảo trì.
  void reason

  // Nút tải lại đưa người dùng về trang gốc của hệ thống (vd. /tuyen-sinh)
  // để middleware kiểm tra lại backend, thay vì reload /error (sẽ đứng yên).
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "")
  const rootHref = basePath ? `${basePath}/` : "/"

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Nền tối + vệt sáng nhẹ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(56,64,120,0.35), transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(190,60,120,0.12), transparent 55%)",
        }}
      />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl backdrop-blur-sm sm:p-12">
          {/* Badge trạng thái */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm text-slate-300">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400" />
            </span>
            NEUAI đang tạm dừng dịch vụ
          </div>

          {/* Tiêu đề */}
          <h1 className="mt-6 font-serif text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Hệ thống đang bảo trì
          </h1>

          {/* Mô tả */}
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Chúng tôi đang nâng cấp hạ tầng để cải thiện độ ổn định và trải nghiệm sử
            dụng. Vui lòng quay lại sau ít phút.
          </p>

          {/* Nút hành động */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={rootHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-white/15"
            >
              <RefreshCw className="h-4 w-4" />
              Thử tải lại trang
            </a>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-5 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/5"
            >
              <LifeBuoy className="h-4 w-4" />
              Liên hệ hỗ trợ
            </a>
          </div>

          {/* Progress bar gradient (indeterminate) */}
          <div className="mt-10 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full w-1/3 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #38bdf8 0%, #6366f1 50%, #ec4899 100%)",
                animation: "neu-maintenance-bar 1.8s ease-in-out infinite",
              }}
            />
          </div>

          {/* Ghi chú cuối */}
          <p className="mt-6 text-sm text-slate-500">
            Chúng tôi sẽ khôi phục dịch vụ sớm nhất có thể.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes neu-maintenance-bar {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  )
}
