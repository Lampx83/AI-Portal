"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import type { TocItem } from "@/lib/markdown-toc";

type Props = {
  content: string;
  toc: TocItem[];
};

export default function DocsViewer({ content, toc }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative mx-auto max-w-[1440px] px-6 lg:px-10 min-h-screen bg-background text-foreground">
      {/* Button mở TOC */}
      <button
        onClick={() => setOpen(true)}
        className="
          hidden lg:flex
          fixed right-6 top-28 z-40
          items-center gap-2
          rounded-full border border-border
          bg-background text-foreground px-4 py-2
          text-sm font-medium
          shadow
          hover:bg-muted hover:text-muted-foreground
        "
      >
        ☰ Mục lục
      </button>

      {/* Markdown content - prose-invert trong dark mode để chữ sáng trên nền tối */}
      <article
        className="
          prose prose-slate max-w-none
          dark:prose-invert
          prose-headings:text-foreground
          prose-p:text-foreground prose-p:opacity-90
          prose-li:text-foreground prose-li:opacity-90
          prose-strong:text-foreground
          prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          scroll-smooth
          [&_h2]:scroll-mt-28
          [&_h3]:scroll-mt-28
        "
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeHighlight]}
        >
          {content}
        </ReactMarkdown>
      </article>

      {/* TOC Drawer */}
      <aside
        className={`
          hidden lg:block
          fixed right-0 top-0 z-50
          h-full w-80
          border-l border-border bg-background
          px-6 py-8
          transition-transform duration-300
          ${open ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Mục lục</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <ul className="space-y-2 text-sm overflow-auto">
          {toc.map((item) => (
            <li key={item.id} style={{ marginLeft: (item.level - 2) * 12 }}>
              <a
                href={`#${item.id}`}
                onClick={() => setOpen(false)}
                className="
                  block rounded-md
                  px-2 py-1
                  text-muted-foreground
                  hover:bg-muted
                  hover:text-foreground
                "
              >
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
