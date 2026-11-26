#!/usr/bin/env node
/**
 * Sinh tài liệu Markdown «Hướng dẫn dự án nghiên cứu» từ frontend/lib/project-stage-guide.ts.
 *
 * Chạy:  node scripts/stage-guide-to-md.mjs [đường-dẫn-đầu-ra.md]
 * Mặc định ghi ra stdout nếu không truyền đường dẫn (có thể đặt biến STAGE_GUIDE_OUT).
 * Cần module `typescript` (frontend/node_modules, hoặc đặt TS_FROM=<thư mục frontend>).
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const srcPath = path.join(root, "frontend/lib/project-stage-guide.ts")

function loadTypescript() {
  const bases = [process.env.TS_FROM, path.join(root, "frontend"), root, "/Users/mac/Documents/Code/AI-Portal/frontend"].filter(Boolean)
  for (const b of bases) {
    try {
      return createRequire(path.join(b, "package.json"))("typescript")
    } catch {
      /* thử nơi khác */
    }
  }
  throw new Error("Không tìm thấy module typescript (đặt TS_FROM=<thư mục có node_modules>)")
}

const ts = loadTypescript()
const js = ts.transpileModule(fs.readFileSync(srcPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText
const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"))
const { STAGE_GUIDES, PROJECT_SETUP_GUIDE } = mod

const STAGE_META = [
  { id: "explore", name: "Tìm hiểu", code: "B1" },
  { id: "review", name: "Tổng quan", code: "B2" },
  { id: "design", name: "Thiết kế và thu thập dữ liệu", code: "B3" },
  { id: "analyze", name: "Phân tích", code: "B4" },
  { id: "write", name: "Viết và phản biện", code: "B5" },
  { id: "publish", name: "Công bố và tài trợ", code: "B6" },
]

const TOOLS = {
  expertfinder: "Tìm kiếm chuyên gia",
  paperfinder: "Tra cứu bài báo",
  bibliomap: "Trắc lượng thư mục",
  surveylab: "Thiết kế khảo sát",
  quantis: "Phân tích định lượng",
  annota: "Phân tích định tính",
  writium: "Viết nghiên cứu",
  paperreviewer: "Phản biện bài báo",
  plagiarismchecker: "Kiểm tra đạo văn",
  "journal-conference": "Hội thảo tạp chí",
  funds: "Tra cứu quỹ tài trợ",
  regulations: "Quy trình, biểu mẫu",
}

const bullets = (arr) => arr.map((x) => `- ${x}`).join("\n")
const out = []
const push = (s = "") => out.push(s)

push("# Hướng dẫn thực hiện dự án nghiên cứu trên AI Portal")
push()
push(
  "Tài liệu dành cho các nhóm sinh viên, nghiên cứu sinh tại Đại học Kinh tế Quốc dân. Dự án nghiên cứu đi qua 6 giai đoạn; mỗi giai đoạn có các bước cụ thể, sản phẩm bàn giao, điều kiện sang giai đoạn sau và công cụ tương ứng trong AI Portal. Các bước ở mỗi giai đoạn cũng là «checklist mẫu» có thể nạp vào dự án."
)
push()
push("| Giai đoạn | Tên | Thời lượng thường gặp | Công cụ chính |")
push("|---|---|---|---|")
STAGE_META.forEach((m, i) => {
  const g = STAGE_GUIDES[m.id]
  const tools = [...new Set(g.steps.map((s) => s.toolAlias).filter(Boolean))].map((a) => TOOLS[a] ?? a).join(", ")
  push(`| ${m.code} | ${m.name} | ${g.duration} | ${tools || "—"} |`)
})
push()

push(`## Chuẩn bị: ${PROJECT_SETUP_GUIDE.title}`)
push()
PROJECT_SETUP_GUIDE.steps.forEach((s, i) => {
  push(`${i + 1}. **${s.title}.** ${s.detail}`)
})
push()
push("### Vai trò trong dự án")
push()
push("| Vai | Quyền |")
push("|---|---|")
PROJECT_SETUP_GUIDE.roles.forEach((r) => push(`| ${r.label} | ${r.can} |`))
push()
push("### Quy ước đặt tên và lưu tệp")
push()
push(bullets(PROJECT_SETUP_GUIDE.fileNaming))
push()
push("### Nhịp làm việc hằng tuần")
push()
push(bullets(PROJECT_SETUP_GUIDE.weeklyRhythm))
push()

STAGE_META.forEach((m, i) => {
  const g = STAGE_GUIDES[m.id]
  push(`## Giai đoạn ${m.code}: ${m.name}`)
  push()
  push(`**Mục tiêu.** ${g.goal}`)
  push()
  push(`**Thời lượng thường gặp.** ${g.duration}`)
  push()
  push("### Các bước thực hiện")
  push()
  g.steps.forEach((s, k) => {
    push(`${k + 1}. **${s.title}.** ${s.detail}`)
    const extra = []
    if (s.output) extra.push(`Sản phẩm: ${s.output}`)
    if (s.toolAlias) extra.push(`Công cụ: ${TOOLS[s.toolAlias] ?? s.toolAlias} (/tools/${s.toolAlias})`)
    if (s.who) extra.push(`Ai làm: ${s.who}`)
    extra.forEach((e) => push(`   - ${e}`))
  })
  push()
  push("### Sản phẩm bàn giao")
  push()
  push(bullets(g.outputs))
  push()
  push("### Đủ điều kiện sang giai đoạn sau khi")
  push()
  push(bullets(g.doneWhen))
  push()
  push("### Lỗi thường gặp")
  push()
  push(bullets(g.mistakes))
  push()
  push("### Mẹo làm việc nhóm")
  push()
  push(bullets(g.teamTips))
  push()
})

const md = out.join("\n").replace(/\n{3,}/g, "\n\n")
const dest = process.argv[2] || process.env.STAGE_GUIDE_OUT
if (dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, md)
  console.error(`Đã ghi ${dest} (${md.length} ký tự, ${md.split("\n").length} dòng)`)
} else {
  process.stdout.write(md)
}
