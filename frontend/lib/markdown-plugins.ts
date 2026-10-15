import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import type { PluggableList } from "unified"

/**
 * Markdown của khung chat: GFM + công thức toán LaTeX ($...$, $$...$$) hiển thị bằng KaTeX.
 * rehype-sanitize chạy TRƯỚC rehype-katex nên phải cho phép các class math-inline / math-display
 * mà remark-math gắn lên phần tử code; KaTeX tự sinh HTML an toàn sau bước làm sạch.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^language-./, "math-inline", "math-display"]],
  },
}

export const chatRemarkPlugins: PluggableList = [remarkGfm, remarkMath]
export const chatRehypePlugins: PluggableList = [
  [rehypeSanitize, sanitizeSchema],
  [rehypeKatex, { throwOnError: false, strict: "ignore" }],
]

/**
 * Chuẩn bị văn bản trước khi render: dấu $ là tiền tệ ("$100", "5$ và 10$") không được hiểu là công thức.
 * Giữ nguyên các cặp $...$ / $$...$$ hợp lệ (mở: sau $ không phải khoảng trắng; đóng: trước $ không phải khoảng trắng
 * và sau $ không phải chữ số), escape các dấu $ còn lại. Đoạn code được giữ nguyên.
 */
export function prepareChatMarkdown(text: string): string {
  if (!text || !text.includes("$")) return text
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => {
      if (i % 2 === 1 || !part.includes("$")) return part // code
      const keep: string[] = []
      const hold = (m: string) => `\u0000${keep.push(m) - 1}\u0000`
      return part
        .replace(/\$\$[\s\S]+?\$\$/g, hold)
        .replace(/(?<![\\$])\$(?![\s$])((?:[^$\n\\]|\\.)*?[^\s$\\])\$(?!\d)/g, hold)
        .replace(/(?<!\\)\$/g, "\\$")
        .replace(/\u0000(\d+)\u0000/g, (_, n) => keep[Number(n)])
    })
    .join("")
}
