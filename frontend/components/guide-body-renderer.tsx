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

/** CKEditor resized block images use inline width on <figure> (e.g. width: 50%;). */
const FIGURE_SAFE_STYLE =
  /^width:\s*[\d.]+(%|px)\s*;?\s*$/i

const guideSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...new Set([...(defaultSchema.tagNames ?? []), "figure", "figcaption"])],
  attributes: {
    ...defaultSchema.attributes,
    figure: ["className", ["style", FIGURE_SAFE_STYLE]],
    figcaption: [],
    img: [
      ...new Set([
        ...(defaultSchema.attributes?.img ?? []),
        "alt",
        "className",
        "loading",
        "decoding",
        "srcSet",
        "sizes",
        ["style", FIGURE_SAFE_STYLE],
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
  "[&_figure.image]:table [&_figure.image]:my-4 [&_figure.image]:max-w-full " +
  "[&_figure.image-style-align-center]:mx-auto " +
  "[&_figure.image-style-block-align-left]:ml-0 [&_figure.image-style-block-align-left]:mr-auto " +
  "[&_figure.image-style-block-align-right]:ml-auto [&_figure.image-style-block-align-right]:mr-0 " +
  "[&_figure.image-style-align-left]:float-left [&_figure.image-style-align-left]:mr-4 [&_figure.image-style-align-left]:mb-2 [&_figure.image-style-align-left]:max-w-[min(100%,24rem)] " +
  "[&_figure.image-style-align-right]:float-right [&_figure.image-style-align-right]:ml-4 [&_figure.image-style-align-right]:mb-2 [&_figure.image-style-align-right]:max-w-[min(100%,24rem)] " +
  "[&_figure.image_img]:max-w-full [&_figure.image_img]:h-auto [&_figure.image_img]:rounded-md [&_figure.image_img]:border [&_figure.image_img]:border-border"

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
