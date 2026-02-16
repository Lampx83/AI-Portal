"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Toggle } from "@/components/ui/toggle"
import {
  Bold,
  Italic,
  Underline,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronDown,
  Table2,
  Sigma,
  Sparkles,
  Loader2,
  Image,
  ImagePlus,
  IndentIncrease,
  IndentDecrease,
  ArrowRightLeft,
  BookMarked,
  ClipboardCheck,
  Search,
  X,
  Superscript,
  Subscript,
} from "lucide-react"
import {
  FONTS,
  FONT_SIZES,
  LINE_SPACING_OPTIONS,
  SCIENTIFIC_SYMBOLS,
  FORMULA_SAMPLES,
  BLOCK_STYLES,
} from "./constants"
import { formatInTextAPA } from "@/lib/citation-formats"
import type { CitationReference } from "@/lib/api/write-articles"

export interface WriteToolbarProps {
  normalizeToolbarFont: (font: string) => string
  currentFont: string
  applyFontFamily: (font: string) => void
  currentFontSize: string
  setCurrentFontSize: (v: string) => void
  applyFontSize: (pt: number) => void
  currentLineSpacing: number
  applyLineHeight: (value: number) => void
  currentBlockTag: string
  setCurrentBlockTag: (tag: string) => void
  execCmd: (cmd: string, value?: string) => void
  removeHighlight: () => void
  imageInputRef: React.RefObject<HTMLInputElement | null>
  handleInsertImage: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleInsertCaption: () => void
  setShowCrossRefDialog: (v: boolean) => void
  savedTableSelectionRef: React.MutableRefObject<Range[]>
  setTableRows: (v: number) => void
  setTableCols: (v: number) => void
  setShowTableDialog: (v: boolean) => void
  editorRef: React.RefObject<HTMLDivElement | null>
  formulaLatex: string
  setFormulaLatex: (v: string) => void
  setFormulaError: (v: string | null) => void
  insertLatexFormula: () => void
  insertLatexFormulaBlock: () => void
  removeFormulaMarkerIfPresent: () => void
  insertFormulaMarkerAtSelection: () => void
  insertHtml: (html: string) => void
  citationStyle: "APA" | "IEEE"
  setCitationStyle: (v: "APA" | "IEEE") => void
  setShowCitationDialog: (v: boolean) => void
  references: CitationReference[]
  handleInsertCitation: (index?: number, apaVariant?: "parenthetical" | "narrative") => void
  handleInsertReferenceList: () => void
  editorEmpty: boolean
  runAcademicQualityCheck: () => void
  academicQualityLoading: boolean
  setShowGeneratePapersDialog: (v: boolean) => void
  showFindBar: boolean
  findQuery: string
  setFindQuery: (v: string) => void
  setFindBackward: (v: boolean) => void
  runFindInEditor: () => void
  setShowFindBar: React.Dispatch<React.SetStateAction<boolean>>
}

export function WriteToolbar(p: WriteToolbarProps) {
  return (
    <>
      <div className="flex-shrink-0 flex items-center gap-0.5 px-2 md:px-3 py-1.5 md:py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto overflow-y-hidden flex-nowrap md:flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[6rem] justify-between font-normal text-xs" title="Phông chữ">
              <span
                className="truncate"
                style={{
                  fontFamily: (() => {
                    const raw = p.normalizeToolbarFont(p.currentFont)
                    const displayFont = FONTS.includes(raw) ? raw : (FONTS.find((f) => raw.includes(f)) ?? raw)
                    return displayFont ? `${displayFont}, sans-serif` : undefined
                  })(),
                }}
              >
                {(() => {
                  const raw = p.normalizeToolbarFont(p.currentFont)
                  return FONTS.includes(raw) ? raw : (FONTS.find((f) => raw.includes(f)) ?? raw)
                })()}
              </span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONTS.map((f) => (
              <DropdownMenuItem key={f} onClick={() => p.applyFontFamily(f)} className={p.currentFont === f ? "bg-muted font-medium" : ""}>
                <span style={{ fontFamily: f }}>{f}</span>
                {p.currentFont === f && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[2.5rem] justify-between font-normal text-xs" title="Cỡ chữ">
              <span>{p.currentFontSize}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {FONT_SIZES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => { p.applyFontSize(s); p.setCurrentFontSize(String(s)) }} className={p.currentFontSize === String(s) ? "bg-muted font-medium" : ""}>
                {s}
                {p.currentFontSize === String(s) && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[5rem] justify-between font-normal text-xs" title="Spacing giữa các dòng">
              <span>{LINE_SPACING_OPTIONS.find((o) => o.value === p.currentLineSpacing)?.label ?? p.currentLineSpacing}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {LINE_SPACING_OPTIONS.map((o) => (
              <DropdownMenuItem key={o.value} onClick={() => p.applyLineHeight(o.value)} className={p.currentLineSpacing === o.value ? "bg-muted font-medium" : ""}>
                {o.label}
                {p.currentLineSpacing === o.value && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-[7rem] justify-between font-normal text-xs" title="Kiểu đoạn văn">
              <span className="truncate">{BLOCK_STYLES.find((s) => s.tag === p.currentBlockTag)?.label ?? "Normal"}</span>
              <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {BLOCK_STYLES.map(({ tag, label }) => (
              <DropdownMenuItem
                key={tag}
                onClick={() => {
                  p.execCmd("formatBlock", tag)
                  p.setCurrentBlockTag(tag)
                }}
                className={p.currentBlockTag === tag ? "bg-muted font-medium" : ""}
              >
                {label}
                {p.currentBlockTag === tag && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => p.execCmd("bold")}>
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => p.execCmd("italic")}>
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle size="sm" className="h-8 w-8 p-0" onPressedChange={() => p.execCmd("underline")}>
          <Underline className="h-4 w-4" />
        </Toggle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Đánh dấu (highlight)"
              onMouseDown={(e) => {
                e.preventDefault()
                p.editorRef.current?.focus()
              }}
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => p.execCmd("backColor", "#fef08a")} title="Tô vàng vùng chọn hoặc text gõ tiếp">
              <Highlighter className="h-4 w-4 mr-2" />
              Đánh dấu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={p.removeHighlight} title="Bỏ đánh dấu / để text tiếp theo không bị highlight">
              Xóa đánh dấu
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Chèn bảng"
          onClick={() => {
            const el = p.editorRef.current
            const sel = window.getSelection()
            p.savedTableSelectionRef.current = []
            if (el && sel && sel.rangeCount) {
              const node = sel.anchorNode
              if (node && el.contains(node)) {
                for (let i = 0; i < sel.rangeCount; i++)
                  p.savedTableSelectionRef.current.push(sel.getRangeAt(i).cloneRange())
              }
            }
            p.setTableRows(3)
            p.setTableCols(3)
            p.setShowTableDialog(true)
          }}
        >
          <Table2 className="h-4 w-4" />
        </Button>
        <input ref={p.imageInputRef} type="file" accept="image/*" className="hidden" onChange={p.handleInsertImage} />
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Chèn ảnh" onClick={() => p.imageInputRef.current?.click()}>
          <Image className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Chú thích và tham chiếu">
              <ImagePlus className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chú thích & Tham chiếu</DropdownMenuLabel>
            <DropdownMenuItem onClick={p.handleInsertCaption}>
              <ImagePlus className="h-4 w-4 mr-2" />
              Chèn chú thích
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.setShowCrossRefDialog(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Chèn tham chiếu (Figure/Table/Equation/Section)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => p.execCmd("insertUnorderedList")} title="Danh sách dấu đầu dòng">
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => p.execCmd("insertOrderedList")} title="Danh sách đánh số">
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={(e) => { e.preventDefault(); p.editorRef.current?.focus(); p.execCmd("indent") }} title="Tăng cấp (Tab)">
          <IndentIncrease className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={(e) => { e.preventDefault(); p.editorRef.current?.focus(); p.execCmd("outdent") }} title="Giảm cấp (Shift+Tab)">
          <IndentDecrease className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => p.execCmd("justifyLeft")}>
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => p.execCmd("justifyCenter")}>
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => p.execCmd("justifyRight")}>
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Căn đều hai bên" onClick={() => p.execCmd("justifyFull")}>
          <AlignJustify className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <DropdownMenu onOpenChange={(open) => { if (!open) p.removeFormulaMarkerIfPresent() }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Công thức và ký hiệu" onPointerDownCapture={() => p.insertFormulaMarkerAtSelection()}>
              <Sigma className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[14rem]" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Gõ công thức (LaTeX)</DropdownMenuLabel>
            <div className="p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                placeholder="VD: \\frac{1}{2}, \\sqrt{x}, \\alpha, \\sum_{i=1}^n"
                value={p.formulaLatex}
                onChange={(e) => { p.setFormulaLatex(e.target.value); p.setFormulaError(null) }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); p.insertLatexFormula() } }}
                className="h-8 text-xs font-mono"
              />
              <div className="flex flex-wrap gap-1">
                {FORMULA_SAMPLES.map((s) => (
                  <Button
                    key={s.latex}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs font-mono"
                    onClick={() => { p.setFormulaLatex(s.latex); p.setFormulaError(null) }}
                    title={s.latex}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={p.insertLatexFormula} disabled={!p.formulaLatex.trim()}>
                  Chèn (inline)
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={p.insertLatexFormulaBlock} disabled={!p.formulaLatex.trim()}>
                  Chèn (block)
                </Button>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => p.execCmd("superscript")}>
              <Superscript className="h-4 w-4 mr-2" />
              Chỉ số trên (x²)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => p.execCmd("subscript")}>
              <Subscript className="h-4 w-4 mr-2" />
              Chỉ số dưới (H₂O)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Ký hiệu khoa học</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-0.5 p-2 max-h-48 overflow-auto">
              {SCIENTIFIC_SYMBOLS.map((s) => (
                <Button key={s.char} variant="ghost" size="sm" className="h-9 w-9 p-0 text-lg font-normal" onClick={() => p.insertHtml(s.char)} title={s.title}>
                  {s.char}
                </Button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Separator orientation="vertical" className="mx-1 h-6" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2" title="Trích dẫn và tài liệu tham khảo">
              <BookMarked className="h-4 w-4 mr-1" />
              <ChevronDown className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[12rem]">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chuẩn trích dẫn</DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex gap-1">
              <button type="button" onClick={() => p.setCitationStyle("APA")} className={`px-2 py-1 text-xs rounded ${p.citationStyle === "APA" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>APA</button>
              <button type="button" onClick={() => p.setCitationStyle("IEEE")} className={`px-2 py-1 text-xs rounded ${p.citationStyle === "IEEE" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>IEEE</button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => p.setShowCitationDialog(true)}>
              <BookMarked className="h-4 w-4 mr-2" />
              Quản lý tài liệu tham khảo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Chèn trích dẫn</DropdownMenuLabel>
            {p.citationStyle === "APA"
              ? p.references.map((r, i) => (
                  <DropdownMenuItem key={i} className="text-xs" onClick={() => p.handleInsertCitation(i, "parenthetical")}>
                    {formatInTextAPA(r)}
                  </DropdownMenuItem>
                ))
              : p.references.map((r, i) => (
                  <DropdownMenuItem key={i} onClick={() => p.handleInsertCitation(i)}>
                    [{i + 1}] {r.title || r.author || "Tài liệu"}
                  </DropdownMenuItem>
                ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => p.handleInsertReferenceList()} disabled={p.references.length === 0}>
              <BookMarked className="h-4 w-4 mr-2" />
              Chèn danh sách TLTK
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!p.editorEmpty && <Separator orientation="vertical" className="mx-1 h-6" />}
        {!p.editorEmpty && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 justify-between font-normal text-xs" title="Kiểm tra" disabled={p.academicQualityLoading}>
                {p.academicQualityLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
                <span className="ml-1">Kiểm tra</span>
                <ChevronDown className="h-3 w-3 ml-0.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Kiểm tra</DropdownMenuLabel>
              <DropdownMenuItem onClick={p.runAcademicQualityCheck} disabled={p.academicQualityLoading}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Chạy kiểm tra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!p.editorEmpty && (
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8 shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 shadow-sm"
            title="AI hỗ trợ viết"
            onClick={() => p.setShowGeneratePapersDialog(true)}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
      </div>

      {p.showFindBar && (
        <div className="flex-shrink-0 flex items-center gap-2 px-2 py-1.5 bg-muted/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Tìm trong bài..."
            value={p.findQuery}
            onChange={(e) => p.setFindQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                p.setFindBackward(e.shiftKey)
                p.runFindInEditor()
              }
            }}
            className="h-8 max-w-[200px] text-sm"
          />
          <Button variant="outline" size="sm" className="h-8" onClick={() => { p.setFindBackward(false); p.runFindInEditor() }}>
            Tìm tiếp
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => { p.setFindBackward(true); p.runFindInEditor() }}>
            Tìm trước
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { p.setShowFindBar(false); p.setFindQuery("") }} title="Đóng">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )
}
