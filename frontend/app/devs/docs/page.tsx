import fs from "fs"
import path from "path"
import { extractToc } from "@/lib/markdown-toc"
import DocsViewer from "@/app/dev/docs/DocsViewer"

export const dynamic = "force-dynamic"

export default function DevsDocsPage() {
  const filePath = path.join(process.cwd(), "docs/README.md")

  let content = ""
  let toc: any[] = []

  try {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, "utf-8")
      toc = extractToc(content)
    } else {
      content = "# Tài liệu nhà phát triển\n\nFile `docs/README.md` không tìm thấy."
    }
  } catch (error) {
    console.error("Error reading docs file:", error)
    content = "# Tài liệu nhà phát triển\n\nLỗi tải tài liệu."
  }

  return <DocsViewer content={content} toc={toc} />
}
