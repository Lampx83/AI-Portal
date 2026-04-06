"use client"

import type { ReactNode } from "react"
import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeParse from "rehype-parse"
import rehypeSanitize from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"
import { defaultSchema, type Schema } from "hast-util-sanitize"
import type { Components } from "react-markdown"
import { cn } from "@/lib/utils"
import { looksLikeGuideHtml } from "@/lib/guide-body-format"
import { rewriteMinioHostsInHtml, rewriteMinioUrlForBrowser } from "@/lib/storage-url-browser"

/** CKEditor: width trên figure/img/span ảnh inline */
const WIDTH_STYLE = /^width:\s*[\d.]+(%|px)\s*;?\s*$/i
/** CKEditor resize có thể set height trên img */
const HEIGHT_STYLE = /^height:\s*[\d.]+(%|px)\s*;?\s*$/i
/** Chữ nhỏ / paste: font-size an toàn (số + px|rem|em|%) */
const FONT_SIZE_STYLE = /^font-size:\s*[\d.]+(px|rem|em|%)\s*;?\s*$/i
/** CKEditor Alignment: text-align trên khối (+ start/end theo logical) */
const TEXT_ALIGN_STYLE =
  /^text-align:\s*(left|right|center|justify|start|end)\s*;?\s*$/i
const WIDTH_THEN_ALIGN =
  /^width:\s*[\d.]+(%|px)\s*;\s*text-align:\s*(left|right|center|justify|start|end)\s*;?\s*$/i
const ALIGN_THEN_WIDTH =
  /^text-align:\s*(left|right|center|justify|start|end)\s*;\s*width:\s*[\d.]+(%|px)\s*;?\s*$/i
const ALIGN_THEN_FONT =
  /^text-align:\s*(left|right|center|justify|start|end)\s*;\s*font-size:\s*[\d.]+(px|rem|em|%)\s*;?\s*$/i
const FONT_THEN_ALIGN =
  /^font-size:\s*[\d.]+(px|rem|em|%)\s*;\s*text-align:\s*(left|right|center|justify|start|end)\s*;?\s*$/i
const WIDTH_THEN_HEIGHT =
  /^width:\s*[\d.]+(%|px)\s*;\s*height:\s*[\d.]+(%|px)\s*;?\s*$/i
const HEIGHT_THEN_WIDTH =
  /^height:\s*[\d.]+(%|px)\s*;\s*width:\s*[\d.]+(%|px)\s*;?\s*$/i

/** CKEditor: text-align / width / font-size trên khối văn bản */
const CK_BLOCK_STYLE: [["style", RegExp, ...RegExp[]]] = [
  [
    "style",
    TEXT_ALIGN_STYLE,
    WIDTH_STYLE,
    FONT_SIZE_STYLE,
    WIDTH_THEN_ALIGN,
    ALIGN_THEN_WIDTH,
    ALIGN_THEN_FONT,
    FONT_THEN_ALIGN,
  ],
]

const guideSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), "figure", "figcaption"])],
  attributes: {
    ...defaultSchema.attributes,
    figure: [
      "className",
      [
        "style",
        WIDTH_STYLE,
        TEXT_ALIGN_STYLE,
        WIDTH_THEN_ALIGN,
        ALIGN_THEN_WIDTH,
        FONT_SIZE_STYLE,
        ALIGN_THEN_FONT,
        FONT_THEN_ALIGN,
      ],
    ],
    figcaption: [["style", TEXT_ALIGN_STYLE, FONT_SIZE_STYLE, ALIGN_THEN_FONT, FONT_THEN_ALIGN]],
    /** class: image-inline, image-style-*, image_resized (CKEditor) */
    span: [
      ["className", /^image(?:[-_][a-z0-9_-]+)*$/i],
      ["style", WIDTH_STYLE, FONT_SIZE_STYLE, ALIGN_THEN_FONT, FONT_THEN_ALIGN],
    ],
    p: [...CK_BLOCK_STYLE],
    div: [...CK_BLOCK_STYLE],
    blockquote: [...CK_BLOCK_STYLE],
    h1: [...CK_BLOCK_STYLE],
    h2: [...CK_BLOCK_STYLE],
    h3: [...CK_BLOCK_STYLE],
    h4: [...CK_BLOCK_STYLE],
    h5: [...CK_BLOCK_STYLE],
    h6: [...CK_BLOCK_STYLE],
    td: [...CK_BLOCK_STYLE],
    th: [...CK_BLOCK_STYLE],
    img: [
      ...new Set([
        ...(defaultSchema.attributes?.img ?? []),
        "alt",
        "className",
        "loading",
        "decoding",
        "srcSet",
        "sizes",
        ["style", WIDTH_STYLE, HEIGHT_STYLE, WIDTH_THEN_HEIGHT, HEIGHT_THEN_WIDTH],
      ]),
    ],
  },
}

const proseGuide =
  "prose prose-sm max-w-none dark:prose-invert prose-p:text-muted-foreground prose-p:leading-6 " +
  "prose-headings:text-foreground prose-strong:text-foreground prose-li:text-muted-foreground " +
  "prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground " +
  "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground " +
  "prose-img:max-w-full prose-img:rounded-md prose-img:border prose-img:border-border " +
  /* Viền/bo góc ảnh trong figure.image — layout figure do globals.css (khớp .ck-content) */
  "[&_figure.image_img]:max-w-full [&_figure.image_img]:h-auto [&_figure.image_img]:rounded-md " +
  "[&_figure.image_img]:border [&_figure.image_img]:border-border " +
  "[&_span.image-style-align-center]:block [&_span.image-style-align-center]:mx-auto [&_span.image-style-align-center]:w-fit [&_span.image-style-align-center]:max-w-full"

function purifyGuideHtml(html: string): string {
  try {
    const file = unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, guideSanitizeSchema)
      .use(rehypeStringify)
      .processSync(html)
    return rewriteMinioHostsInHtml(String(file))
  } catch {
    return rewriteMinioHostsInHtml("")
  }
}

const guideMarkdownComponents: Components = {
  img: ({ src, alt, className: imgClass, ...props }) => {
    const resolved = src != null && src !== "" ? rewriteMinioUrlForBrowser(String(src)) : src
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={alt ?? ""}
        className={cn("max-w-full h-auto rounded-md border border-border my-3", imgClass)}
        loading="lazy"
        {...props}
      />
    )
  },
  a: ({ href, children, ...rest }) => (
    <a
      href={href != null && href !== "" ? rewriteMinioUrlForBrowser(String(href)) : (href ?? "#")}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
      {...rest}
    >
      {children}
    </a>
  ),
}

type GuideBodyRendererProps = {
  source: string
  className?: string
  emptyFallback?: ReactNode
}

export function GuideBodyRenderer({ source, className, emptyFallback }: GuideBodyRendererProps) {
  const t = source.trim()
  const rehypePlugins = useMemo(() => [[rehypeSanitize, guideSanitizeSchema] as const], [])

  if (!t) {
    return (
      <div className={className}>
        {emptyFallback ?? <p className="text-sm text-muted-foreground">&nbsp;</p>}
      </div>
    )
  }

  if (looksLikeGuideHtml(t)) {
    const safe = purifyGuideHtml(t)
    return (
      <div
        className={cn(proseGuide, "guide-body-html", "flow-root", className)}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    )
  }

  return (
    <div className={cn(proseGuide, "flow-root", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={guideMarkdownComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
