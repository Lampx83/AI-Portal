import fs from "fs";
import path from "path";
import { extractToc } from "@/lib/markdown-toc";
import DocsViewer from "./DocsViewer";

export default function DocsPage() {
  const filePath = path.join(process.cwd(), "docs/README.md");
  const content = fs.readFileSync(filePath, "utf-8");
  const toc = extractToc(content);

  return <DocsViewer content={content} toc={toc} />;
}
