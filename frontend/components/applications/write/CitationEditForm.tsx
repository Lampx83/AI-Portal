"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload } from "lucide-react"
import type { CitationReference } from "@/lib/api/write-articles"
import { parseCitationFormat } from "@/lib/citation-formats"
import { REF_TYPES } from "./constants"

export function CitationEditForm({
  initialRef,
  onSave,
  onCancel,
}: {
  initialRef: CitationReference & { __tempId?: number; __editIndex?: number }
  onSave: (r: CitationReference) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CitationReference>({
    type: initialRef.type || "article",
    author: initialRef.author || "",
    title: initialRef.title || "",
    year: initialRef.year || "",
    journal: initialRef.journal || "",
    volume: initialRef.volume || "",
    pages: initialRef.pages || "",
    publisher: initialRef.publisher || "",
    doi: initialRef.doi || "",
    url: initialRef.url || "",
    booktitle: initialRef.booktitle || "",
  })
  const [pasteValue, setPasteValue] = useState("")
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const applyParsedToForm = (parsed: { ref: CitationReference }) => {
    const ref = parsed.ref
    const updates: CitationReference = {
      type: ref.type || "article",
      author: ref.author || "",
      title: ref.title || "",
      year: ref.year || "",
      journal: ref.journal || "",
      volume: ref.volume || "",
      pages: ref.pages || "",
      publisher: ref.publisher || "",
      doi: ref.doi || "",
      url: ref.url || "",
      booktitle: ref.booktitle || "",
    }
    const filled = new Set<string>()
    if (updates.type) filled.add("type")
    if (updates.author) filled.add("author")
    if (updates.title) filled.add("title")
    if (updates.year) filled.add("year")
    if (updates.journal || updates.booktitle) filled.add("journal")
    if (updates.volume || updates.pages) filled.add("volume")
    if (updates.publisher) filled.add("publisher")
    if (updates.doi) filled.add("doi")
    if (updates.url) filled.add("url")
    setForm(updates)
    setHighlightedFields(filled)
    setTimeout(() => setHighlightedFields(new Set()), 2500)
  }

  const handlePasteParse = () => {
    const parsed = parseCitationFormat(pasteValue)
    if (parsed) {
      applyParsedToForm(parsed)
      setPasteError(null)
    } else {
      setPasteError("Không nhận dạng được format. Hỗ trợ: BibTeX, EndNote, RefMan, RefWorks.")
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = (reader.result as string) || ""
      setPasteValue(text)
      setPasteError(null)
      const parsed = parseCitationFormat(text)
      if (parsed) {
        applyParsedToForm(parsed)
      } else {
        setPasteError("Không nhận dạng được format trong file.")
      }
    }
    reader.readAsText(file, "utf-8")
  }

  const inputHighlight = (field: string) =>
    highlightedFields.has(field)
      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-600"
      : ""

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <label className="text-xs font-medium">
          Dán chuỗi trích dẫn hoặc tải file (BibTeX, EndNote, RefMan, RefWorks)
        </label>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".bib,.enw,.ris,.txt,text/plain,application/x-bibtex"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Tải file
          </Button>
        </div>
        <textarea
          value={pasteValue}
          onChange={(e) => {
            setPasteValue(e.target.value)
            setPasteError(null)
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData?.getData("text") ?? ""
            if (pasted.trim()) {
              const parsed = parseCitationFormat(pasted)
              if (parsed) {
                e.preventDefault()
                setPasteValue(pasted)
                applyParsedToForm(parsed)
                setPasteError(null)
              }
            }
          }}
          placeholder="Dán chuỗi BibTeX, EndNote (.enw), RefMan (.ris), RefWorks... hoặc tải file lên"
          className="w-full min-h-[72px] text-sm rounded border px-3 py-2 resize-none placeholder:text-muted-foreground"
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePasteParse}
            disabled={!pasteValue.trim()}
          >
            Nhận dạng & điền
          </Button>
          {pasteError && (
            <span className="text-xs text-red-600 dark:text-red-400">{pasteError}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">Loại</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className={`w-full mt-0.5 h-9 rounded border px-2 text-sm transition-colors ${inputHighlight("type")}`}
          >
            {REF_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Năm</label>
          <Input
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            className={`h-9 mt-0.5 ${inputHighlight("year")}`}
            placeholder="2024"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">Tác giả</label>
        <Input
          value={form.author}
          onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
          className={`h-9 mt-0.5 ${inputHighlight("author")}`}
          placeholder="Nguyễn Văn A, Trần Thị B"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Tiêu đề</label>
        <Input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={`h-9 mt-0.5 ${inputHighlight("title")}`}
          placeholder="Tiêu đề bài báo/sách"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">Tạp chí / Sách / Hội nghị</label>
          <Input
            value={form.journal || form.booktitle || ""}
            onChange={(e) => {
              const v = e.target.value
              setForm((f) => ({ ...f, journal: v, booktitle: v }))
            }}
            className={`h-9 mt-0.5 ${inputHighlight("journal")}`}
            placeholder="Tên tạp chí, sách hoặc hội nghị"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Tập / Trang</label>
          <Input
            value={[form.volume, form.pages].filter(Boolean).join(", ")}
            onChange={(e) => {
              const v = e.target.value
              const parts = v.split(",").map((s) => s.trim())
              setForm((f) => ({ ...f, volume: parts[0] || "", pages: parts[1] || "" }))
            }}
            className={`h-9 mt-0.5 ${inputHighlight("volume")}`}
            placeholder="10, 1-15"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium">DOI</label>
          <Input
            value={form.doi}
            onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))}
            className={`h-9 mt-0.5 ${inputHighlight("doi")}`}
            placeholder="10.1234/..."
          />
        </div>
        <div>
          <label className="text-xs font-medium">URL</label>
          <Input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className={`h-9 mt-0.5 ${inputHighlight("url")}`}
            placeholder="https://..."
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={() => onSave(form)}>
          Lưu
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </div>
  )
}
