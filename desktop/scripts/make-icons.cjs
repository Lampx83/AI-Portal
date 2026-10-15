/**
 * Tạo biểu tượng ứng dụng từ logo hệ thống (frontend/public/NEU.svg).
 * Chạy: npm run icons   (dùng chính Electron để vẽ SVG → PNG, không cần công cụ ngoài)
 * Kết quả: build/icon.png (1024), build/icon.icns (macOS, cần iconutil), build/icon.ico (Windows).
 */
const { app, BrowserWindow, nativeImage } = require("electron")
const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

const ROOT = path.join(__dirname, "..")
const SVG = path.join(ROOT, "..", "frontend", "public", "NEU.svg")
const OUT = path.join(ROOT, "build")
const SIZE = 1024
// Lưới biểu tượng macOS: thân biểu tượng ~824/1024, chừa lề cho bóng.
const BODY = 824

function writeIco(file, pngs) {
  // ICO chứa ảnh PNG (hỗ trợ từ Windows Vista).
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const dir = Buffer.alloc(16 * pngs.length)
  let offset = 6 + dir.length
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16
    dir.writeUInt8(size >= 256 ? 0 : size, o)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1)
    dir.writeUInt8(0, o + 2)
    dir.writeUInt8(0, o + 3)
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(data.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += data.length
  })
  fs.writeFileSync(file, Buffer.concat([header, dir, ...pngs.map((p) => p.data)]))
}

app.whenReady().then(async () => {
  const svg = fs.readFileSync(SVG, "utf8")
  const pad = (SIZE - BODY) / 2
  const html = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}
    .c{position:absolute;left:${pad}px;top:${pad}px;width:${BODY}px;height:${BODY}px;border-radius:50%;
    box-shadow:0 10px 24px rgba(0,0,0,.28)}</style></head><body>
    <div class="c"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="${BODY}" height="${BODY}"></div></body></html>`
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true },
  })
  await win.loadURL("data:text/html;base64," + Buffer.from(html).toString("base64"))
  await new Promise((r) => setTimeout(r, 500))
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  if (img.getSize().width !== SIZE) img = img.resize({ width: SIZE, height: SIZE, quality: "best" })
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, "icon.png"), img.toPNG())

  const at = (s) => nativeImage.createFromBuffer(img.toPNG()).resize({ width: s, height: s, quality: "best" }).toPNG()

  // macOS .icns qua iconutil
  if (process.platform === "darwin") {
    const set = path.join(OUT, "icon.iconset")
    fs.rmSync(set, { recursive: true, force: true })
    fs.mkdirSync(set)
    for (const s of [16, 32, 128, 256, 512]) {
      fs.writeFileSync(path.join(set, `icon_${s}x${s}.png`), at(s))
      fs.writeFileSync(path.join(set, `icon_${s}x${s}@2x.png`), at(s * 2))
    }
    execFileSync("iconutil", ["-c", "icns", set, "-o", path.join(OUT, "icon.icns")])
    fs.rmSync(set, { recursive: true, force: true })
  }

  // Windows .ico: biểu tượng Windows dùng toàn khung, không chừa lề kiểu macOS.
  const full = await (async () => {
    const h = `<!doctype html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}</style></head><body>
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}" width="256" height="256"></body></html>`
    const w = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, transparent: true, useContentSize: true, webPreferences: { offscreen: true } })
    await w.loadURL("data:text/html;base64," + Buffer.from(h).toString("base64"))
    await new Promise((r) => setTimeout(r, 300))
    const i = await w.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 })
    return i.getSize().width === 256 ? i : i.resize({ width: 256, height: 256, quality: "best" })
  })()
  const ico = [16, 24, 32, 48, 64, 128, 256].map((s) => ({
    size: s,
    data: s === 256 ? full.toPNG() : full.resize({ width: s, height: s, quality: "best" }).toPNG(),
  }))
  writeIco(path.join(OUT, "icon.ico"), ico)
  console.log("Đã tạo build/icon.png, build/icon.icns, build/icon.ico")
  app.quit()
})
