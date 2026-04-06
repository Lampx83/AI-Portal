"use client"

import { useMemo } from "react"
import { CKEditor } from "@ckeditor/ckeditor5-react"
import {
  Autoformat,
  AutoImage,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Heading,
  ImageBlock,
  ImageResize,
  ImageStyle,
  ImageTextAlternative,
  ImageToolbar,
  ImageUpload,
  Indent,
  IndentBlock,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  Plugin,
  Table,
  TableToolbar,
  TodoList,
  Underline,
} from "ckeditor5"
import "ckeditor5/ckeditor5.css"
import { guideMarkdownToHtml, looksLikeGuideHtml } from "@/lib/guide-body-format"
import { rewriteMinioHostsInHtml, rewriteMinioUrlForBrowser } from "@/lib/storage-url-browser"

function dataForClassicEditor(raw: string): string {
  const v = raw ?? ""
  if (!v.trim()) return ""
  const html = looksLikeGuideHtml(v) ? v : guideMarkdownToHtml(v)
  return rewriteMinioHostsInHtml(html)
}

class PortalGuideUploadAdapter extends Plugin {
  static get pluginName() {
    return "PortalGuideUploadAdapter"
  }

  init() {
    const editor = this.editor
    const apiBase = (editor.config.get("portalGuideUpload.apiBase") as string) || ""
    const userEmail = (editor.config.get("portalGuideUpload.userEmail") as string) || "guide-page"

    editor.plugins.get("FileRepository").createUploadAdapter = (loader) => ({
      upload: () =>
        loader.file.then(
          (file: File) =>
            new Promise<{ default: string }>((resolve, reject) => {
              const fd = new FormData()
              fd.append("file", file)
              fd.append("userEmail", userEmail)
              const url = `${apiBase.replace(/\/+$/, "")}/api/upload?folder=guide-page`
              fetch(url, { method: "POST", body: fd })
                .then((r) => r.json())
                .then((data: { files?: string[]; error?: string }) => {
                  const u = data.files?.[0]
                  if (u) resolve({ default: rewriteMinioUrlForBrowser(u) })
                  else reject(new Error(data.error || "Upload failed"))
                })
                .catch(reject)
            })
        ),
      abort: () => {},
    })
  }
}

/**
 * Hỗ trợ hai cách gọi (tránh lệch chunk Turbopack/HMR):
 * - createEditorConfig(t, apiBase, userEmail)
 * - createEditorConfig({ apiBase, userEmail })
 */
function createEditorConfig(
  tOrOpts: { apiBase: string; userEmail: string } | ((key: string) => string),
  apiBaseArg?: string,
  userEmailArg?: string
): Record<string, unknown> {
  let apiBase: string
  let userEmail: string
  if (typeof tOrOpts === "function") {
    apiBase = apiBaseArg ?? ""
    userEmail = userEmailArg ?? ""
    void tOrOpts
  } else if (
    tOrOpts != null &&
    typeof tOrOpts === "object" &&
    "apiBase" in tOrOpts &&
    "userEmail" in tOrOpts
  ) {
    apiBase = tOrOpts.apiBase
    userEmail = tOrOpts.userEmail
  } else {
    apiBase = ""
    userEmail = ""
  }
  return {
    licenseKey: "GPL",
    plugins: [
      Essentials,
      Autoformat,
      AutoImage,
      Paragraph,
      Bold,
      Italic,
      Underline,
      Link,
      List,
      TodoList,
      Heading,
      BlockQuote,
      Indent,
      ImageBlock,
      ImageResize,
      ImageStyle,
      ImageTextAlternative,
      ImageToolbar,
      ImageUpload,
      PasteFromOffice,
      Table,
      TableToolbar,
      IndentBlock,
      PortalGuideUploadAdapter,
    ],
    toolbar: {
      items: [
        "undo",
        "redo",
        "|",
        "heading",
        "|",
        "bold",
        "italic",
        "underline",
        "link",
        "|",
        "bulletedList",
        "numberedList",
        "todoList",
        "|",
        "outdent",
        "indent",
        "|",
        "blockQuote",
        "insertTable",
        "|",
        "uploadImage",
      ],
    },
    heading: {
      options: [
        { model: "paragraph" as const, title: "Paragraph", class: "ck-heading_paragraph" },
        { model: "heading2" as const, view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
        { model: "heading3" as const, view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
      ],
    },
    // Balloon ảnh: dùng nút resize riêng (có icon) thay vì dropdown — dropdown dễ bị gom vào “…” hoặc khó thấy
    image: {
      toolbar: [
        "resizeImage:original",
        "resizeImage:25",
        "resizeImage:50",
        "resizeImage:75",
        "|",
        "imageStyle:breakText",
        "|",
        "imageTextAlternative",
      ],
      resizeUnit: "%",
      resizeOptions: [
        { name: "resizeImage:original", value: null, icon: "original", label: "Original" },
        { name: "resizeImage:25", value: "25", icon: "small", label: "25%" },
        { name: "resizeImage:50", value: "50", icon: "medium", label: "50%" },
        { name: "resizeImage:75", value: "75", icon: "large", label: "75%" },
      ],
    },
    table: {
      contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
    },
    link: {
      addTargetToExternalLinks: true,
      defaultProtocol: "https://",
    },
    placeholder: "",
    portalGuideUpload: {
      apiBase,
      userEmail,
    },
  }
}

export type GuideCkEditorApi = {
  execute: (name: string, payload?: Record<string, unknown>) => void
  getData: () => string
}

type GuideCkEditorInnerProps = {
  cardIndex: number
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  t: (key: string) => string
  apiBase: string
  userEmail: string
  onReady?: (editor: GuideCkEditorApi) => void
}

export function GuideCkEditorInner({
  cardIndex,
  value,
  onChange,
  disabled,
  t,
  apiBase,
  userEmail,
  onReady: onEditorReady,
}: GuideCkEditorInnerProps) {
  const ckData = useMemo(() => dataForClassicEditor(value), [value])
  const config = useMemo(
    () => createEditorConfig(t, apiBase, userEmail),
    [t, apiBase, userEmail]
  )

  return (
    <div
      className={
        "portal-guide-ck-root [&_.ck-editor__editable]:min-h-[220px] [&_.ck-toolbar]:flex-wrap " +
        "[&_.ck-balloon-panel_.ck-toolbar]:flex-wrap [&_.ck-balloon-panel_.ck-toolbar]:gap-0.5 [&_.ck-balloon-panel_.ck-toolbar]:justify-start"
      }
    >
      {/* Đổi suffix key khi đổi config CKEditor — buộc tạo lại editor (tránh instance cũ sau HMR/cache). */}
      <CKEditor
        key={`guide-ck-${cardIndex}-imgtb-r4`}
        editor={ClassicEditor}
        config={config}
        data={ckData}
        disabled={disabled}
        onReady={(editor) => {
          onEditorReady?.(editor as unknown as GuideCkEditorApi)
        }}
        onChange={(_event, editor) => {
          onChange(editor.getData())
        }}
      />
    </div>
  )
}
