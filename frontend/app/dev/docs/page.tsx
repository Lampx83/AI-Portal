import fs from "fs";
import path from "path";
import { extractToc } from "@/lib/markdown-toc";
import DocsViewer from "./DocsViewer";

// Disable static generation to avoid build-time file reading issues
export const dynamic = 'force-dynamic';

export default function DocsPage() {
  const filePath = path.join(process.cwd(), "docs/README.md");
  
  let content = "";
  let toc: any[] = [];
  
  try {
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, "utf-8");
      toc = extractToc(content);
    } else {
      content = "# Documentation\n\nFile `docs/README.md` not found.";
    }
  } catch (error) {
    console.error("Error reading docs file:", error);
    content = "# Documentation\n\nError loading documentation.";
  }

  return <DocsViewer content={content} toc={toc} />;
}
