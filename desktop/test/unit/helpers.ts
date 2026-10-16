/** Dữ liệu dựng sẵn cho kiểm thử trợ lý thư mục (không phải tệp kiểm thử). */
import fs from "fs"
import os from "os"
import path from "path"
import { ConfigStore } from "../../src/main/config"
import { ProjectFolderService } from "../../src/main/projectFolders"
import { ChangeService } from "../../src/main/agent/changes"

const PID = "proj-1"

export function setupProject() {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "neu-agent-")))
  const home = path.join(base, "home")
  const proj = path.join(home, "NCKH", "DeTai")
  fs.mkdirSync(path.join(proj, "notes"), { recursive: true })
  fs.writeFileSync(path.join(proj, "bao-cao.md"), "# Báo cáo\n\nĐây là đoạn mở đầu có lổi chính tả.\nKết luận.\n")
  fs.writeFileSync(path.join(proj, "notes", "windows.txt"), "dòng 1\r\ndòng 2\r\n")
  fs.writeFileSync(path.join(base, "outside.md"), "BÍ MẬT")
  fs.mkdirSync(path.join(base, "outdir"))
  fs.symlinkSync(path.join(base, "outside.md"), path.join(proj, "leak.md"))
  fs.symlinkSync(path.join(base, "outdir"), path.join(proj, "linkdir"))
  const store = new ConfigStore(path.join(base, "cfg", "config.json"))
  const folders = new ProjectFolderService(store, () => "https://research.neu.edu.vn", home)
  // liên kết trực tiếp (bỏ qua hộp thoại)
  folders.link(PID, proj)
  const changes = new ChangeService({ resolveRoot: (p) => folders.resolveFolder(p), storeFile: (p) => path.join(base, "userdata", p, "changes.json") })
  return { base, proj, folders, changes, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) }
}

/** PDF một trang tối thiểu (xref đúng offset). */
export function minimalPdf(text: string): Buffer {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  const stream = `BT /F1 18 Tf 20 60 Td (${text}) Tj ET`
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let out = "%PDF-1.4\n"
  const offsets: number[] = []
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out))
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(out)
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, "latin1")
}
