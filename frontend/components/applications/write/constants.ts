export type Template = { id: string; title: string; description?: string; type?: string }

export const FONTS = ["Arial", "Times New Roman", "Georgia", "Cambria", "Calibri"]
export const FONT_SIZES = [10, 11, 12, 14, 16, 20]

export const LINE_SPACING_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Đơn (1)" },
  { value: 1.15, label: "1.15" },
  { value: 1.5, label: "1.5" },
  { value: 2, label: "Đôi (2)" },
  { value: 2.5, label: "2.5" },
  { value: 3, label: "3" },
]

export const SCIENTIFIC_SYMBOLS = [
  { label: "α", char: "α", title: "Alpha" },
  { label: "β", char: "β", title: "Beta" },
  { label: "γ", char: "γ", title: "Gamma" },
  { label: "δ", char: "δ", title: "Delta" },
  { label: "ε", char: "ε", title: "Epsilon" },
  { label: "θ", char: "θ", title: "Theta" },
  { label: "μ", char: "μ", title: "Mu" },
  { label: "π", char: "π", title: "Pi" },
  { label: "σ", char: "σ", title: "Sigma" },
  { label: "ω", char: "ω", title: "Omega" },
  { label: "∑", char: "∑", title: "Tổng" },
  { label: "∫", char: "∫", title: "Tích phân" },
  { label: "≈", char: "≈", title: "Xấp xỉ" },
  { label: "±", char: "±", title: "Cộng trừ" },
  { label: "≤", char: "≤", title: "Nhỏ hơn hoặc bằng" },
  { label: "≥", char: "≥", title: "Lớn hơn hoặc bằng" },
  { label: "≠", char: "≠", title: "Khác" },
  { label: "°", char: "°", title: "Độ" },
  { label: "×", char: "×", title: "Nhân" },
  { label: "÷", char: "÷", title: "Chia" },
  { label: "→", char: "→", title: "Mũi tên" },
  { label: "∞", char: "∞", title: "Vô cùng" },
]

export const FORMULA_INSERT_MARKER_ID = "formula-insert-marker"

export const FORMULA_SAMPLES: { label: string; latex: string }[] = [
  { label: "½", latex: "\\frac{1}{2}" },
  { label: "√x", latex: "\\sqrt{x}" },
  { label: "x²", latex: "x^2" },
  { label: "α, β", latex: "\\alpha, \\beta" },
  { label: "∑", latex: "\\sum_{i=1}^n x_i" },
  { label: "∫", latex: "\\int_0^1 x^2 \\, dx" },
  { label: "→", latex: "a \\rightarrow b" },
  { label: "≠, ≤, ≥", latex: "a \\neq b,\\quad a \\le b,\\quad a \\ge b" },
]

export const REF_TYPES = [
  { value: "article", label: "Bài báo" },
  { value: "book", label: "Sách" },
  { value: "inproceedings", label: "Hội nghị" },
  { value: "misc", label: "Khác" },
]

export const BLOCK_STYLES = [
  { tag: "p", label: "Normal" },
  { tag: "h1", label: "Title" },
  { tag: "h2", label: "Subtitle" },
  { tag: "h3", label: "Heading 1" },
  { tag: "h4", label: "Heading 2" },
  { tag: "h5", label: "Heading 3" },
  { tag: "h6", label: "Heading 4" },
] as const

export const INLINE_EDIT_PROMPTS = [
  { label: "Rút gọn", prompt: "Rút gọn đoạn văn sau, giữ ý chính:" },
  { label: "Làm rõ hơn", prompt: "Viết lại cho rõ ràng, dễ hiểu hơn:" },
  { label: "Phong cách học thuật", prompt: "Viết lại theo phong cách học thuật:" },
  {
    label: "Paraphrase",
    prompt: "Paraphrase đoạn văn sau (viết lại bằng từ ngữ khác, giữ nghĩa):",
  },
  { label: "Mở rộng", prompt: "Mở rộng chi tiết đoạn văn sau:" },
]
