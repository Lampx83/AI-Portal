import { unified } from "unified"
import remarkParse from "remark-parse"
import { visit } from "unist-util-visit"
import GithubSlugger from "github-slugger"
import { toString } from "mdast-util-to-string"

export type TocItem = {
  id: string
  title: string
  level: number
}

export function extractToc(markdown: string): TocItem[] {
  const tree = unified().use(remarkParse).parse(markdown)

  const slugger = new GithubSlugger()
  const toc: TocItem[] = []

  visit(tree, "heading", (node: any) => {
    const title = toString(node).trim()
    if (!title) return

    if (node.depth >= 2 && node.depth <= 4) {
      const id = slugger.slug(title) // đồng nhất với rehype-slug
      toc.push({ id, title, level: node.depth })
    }
  })

  return toc
}
