/**
 * Tiến trình chính của ứng dụng NEU Research (Electron).
 *
 * Cửa sổ chính hiển thị chính hệ thống web (mặc định https://research.neu.edu.vn). Ứng dụng thêm:
 *  - phiên đăng nhập lưu bền (partition persist:neu-research),
 *  - liên kết dự án với thư mục trên máy (chỉ đọc ở giai đoạn 1) qua `window.neuDesktop`,
 *  - menu tiếng Việt/Anh, ghi nhớ cửa sổ, chặn điều hướng lạ, từ chối quyền không cần.
 */
import { app, BrowserWindow, dialog, Menu, screen, session, shell, type Session, type WebContents } from "electron"
import path from "path"
import { ConfigStore, DEFAULT_PORTAL_URL } from "./config"
import { tr } from "./i18n"
import { getActiveProject, registerIpc, sendMenuCommand } from "./ipc"
import { buildMenu } from "./menu"
import {
  decideNavigation,
  decidePermission,
  decideWindowOpen,
  DEFAULT_AUTH_HOSTS,
  isPortalUrl,
  parsePortalUrl,
  type PortalTarget,
} from "./policy"
import { ProjectFolderService } from "./projectFolders"
import { restoreBounds } from "./windowState"

// ───────────────────────── Khởi tạo, tham số dòng lệnh ─────────────────────────
const argv = process.argv.slice(1)
const argVal = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const isDev = !app.isPackaged || argv.includes("--dev")
/** Chế độ kiểm thử tự động: chỉ có hiệu lực khi chạy từ mã nguồn (không đóng gói). */
const isE2E = !app.isPackaged && process.env.NEU_DESKTOP_E2E === "1"
const PARTITION = "persist:neu-research"
const ROOT_DIR = path.join(__dirname, "..", "..", "..")
const PRELOAD = path.join(__dirname, "..", "preload", "preload.js")
const ICON = path.join(ROOT_DIR, "build", "icon.png")
const OFFLINE_PAGE = path.join(ROOT_DIR, "renderer", "offline.html")

app.setName("NEU Research")
if (process.env.NEU_DESKTOP_USER_DATA && !app.isPackaged) app.setPath("userData", process.env.NEU_DESKTOP_USER_DATA)
app.enableSandbox()

const config = new ConfigStore(path.join(app.getPath("userData"), "neu-desktop-config.json"))

function resolvePortal(): PortalTarget {
  const candidates = [argVal("portal-url"), process.env.NEU_PORTAL_URL, config.get().portalUrl, DEFAULT_PORTAL_URL]
  for (const c of candidates) {
    if (!c) continue
    try {
      return parsePortalUrl(c)
    } catch (e) {
      console.warn(`[neu] bỏ qua địa chỉ hệ thống không hợp lệ (${c}): ${(e as Error).message}`)
    }
  }
  return parsePortalUrl(DEFAULT_PORTAL_URL)
}

let portal = resolvePortal()
let mainWindow: BrowserWindow | null = null
const appWindows = new Set<number>()
const authHosts = () => [...DEFAULT_AUTH_HOSTS, ...(config.get().extraAuthHosts ?? [])]
const locale = () => config.get().menuLocale ?? "vi"

// ───────────────────────── Thao tác hệ điều hành (có móc kiểm thử) ─────────────────────────
type E2EGlobals = { __neuExternalOpened?: string[]; __neuShellCalls?: string[]; __neuNextPick?: string | null }
const g = globalThis as unknown as E2EGlobals
if (isE2E) {
  g.__neuExternalOpened = []
  g.__neuShellCalls = []
  g.__neuNextPick = null
}

function openExternal(url: string): void {
  if (!/^(https?|mailto):/i.test(url)) return
  if (isE2E) {
    g.__neuExternalOpened!.push(url)
    return
  }
  void shell.openExternal(url)
}

const folders = new ProjectFolderService(config, () => portal.origin)

registerIpc({
  folders,
  getPortal: () => portal,
  isAppWindow: (wc) => {
    const w = BrowserWindow.fromWebContents(wc)
    return !!w && appWindows.has(w.id)
  },
  showOpenDialog: async (win) => {
    if (isE2E) {
      const p = g.__neuNextPick ?? null
      g.__neuNextPick = null
      return p
    }
    const opts: Electron.OpenDialogOptions = {
      title: tr(locale(), "pickFolderTitle"),
      buttonLabel: tr(locale(), "pickFolderButton"),
      properties: ["openDirectory", "createDirectory"],
    }
    const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
  },
  openPath: async (p) => {
    if (isE2E) {
      g.__neuShellCalls!.push(`open:${p}`)
      return ""
    }
    return shell.openPath(p)
  },
  showItemInFolder: (p) => {
    if (isE2E) {
      g.__neuShellCalls!.push(`reveal:${p}`)
      return
    }
    shell.showItemInFolder(p)
  },
  onActiveProjectChanged: () => refreshMenu(),
})

// ───────────────────────── Phiên & quyền ─────────────────────────
function cleanUserAgent(ua: string): string {
  const base = ua.replace(/\s?(Electron|NEU[ -]?Research|neu-research-desktop)\/\S+/gi, "").trim()
  return `${base} NEUResearchDesktop/${app.getVersion()}`
}

function configureSession(ses: Session): void {
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()))
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const url = details.requestingUrl || wc.getURL()
    const ok = decidePermission(permission, url, portal, { mediaTypes: (details as { mediaTypes?: string[] }).mediaTypes })
    if (!ok) console.info(`[neu] từ chối quyền ${permission} cho ${safeOrigin(url)}`)
    callback(ok)
  })
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
    const mediaType = (details as { mediaType?: string }).mediaType
    return decidePermission(permission, requestingOrigin, portal, { mediaTypes: mediaType ? [mediaType] : [] })
  })
  ses.setDevicePermissionHandler(() => false)
  ses.on("will-download", (_e, _item, wc) => {
    // Cửa sổ con mở ra chỉ để tải tệp (vd Admin → Lưu trữ) → đóng lại cho gọn.
    const w = wc && !wc.isDestroyed() ? BrowserWindow.fromWebContents(wc) : null
    if (w && w !== mainWindow && (wc.getURL() === "" || wc.getURL() === "about:blank")) setTimeout(() => w.close(), 200)
  })
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return "?"
  }
}

// ───────────────────────── Cửa sổ ─────────────────────────
function webPreferences(): Electron.WebPreferences {
  return {
    preload: PRELOAD,
    partition: PARTITION,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    spellcheck: true,
    additionalArguments: [
      `--neu-portal-origin=${encodeURIComponent(portal.origin)}`,
      `--neu-portal-base=${encodeURIComponent(portal.basePath)}`,
      `--neu-app-version=${encodeURIComponent(app.getVersion())}`,
    ],
  }
}

/** Gắn chính sách cho mọi webContents (cửa sổ chính, cửa sổ con). */
function guardWebContents(wc: WebContents): void {
  wc.on("will-attach-webview", (e) => e.preventDefault())

  const onNav = (e: Electron.Event, url: string, kind: string) => {
    const d = decideNavigation(url, portal, authHosts())
    if (d === "allow") return
    e.preventDefault()
    if (d === "external") openExternal(url)
    console.info(`[neu] ${kind}: ${d === "external" ? "mở bằng trình duyệt" : "chặn"} ${safeOrigin(url)}`)
  }
  wc.on("will-navigate", (e) => onNav(e, e.url, "điều hướng"))
  wc.on("will-redirect", (e) => {
    if (e.isMainFrame) onNav(e, e.url, "chuyển hướng")
  })

  wc.setWindowOpenHandler(({ url }) => {
    const d = decideWindowOpen(url, portal)
    if (d === "child") {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 800,
          icon: ICON,
          autoHideMenuBar: false,
          webPreferences: webPreferences(),
        },
      }
    }
    if (d === "external") openExternal(url)
    else console.info(`[neu] chặn mở cửa sổ ${safeOrigin(url)}`)
    return { action: "deny" }
  })

  wc.on("did-create-window", (child) => registerWindow(child))

  wc.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    // -3 = ERR_ABORTED (điều hướng bị huỷ/chặn có chủ đích), bỏ qua.
    if (!isMainFrame || code === -3 || !isPortalUrl(url, portal)) return
    console.warn(`[neu] không tải được ${url}: ${desc} (${code})`)
    void wc.loadFile(OFFLINE_PAGE, { query: { url, lang: locale(), error: desc } })
  })

  wc.on("zoom-changed", (_e, dir) => zoomBy(wc, dir === "in" ? 0.5 : -0.5))
}

function registerWindow(win: BrowserWindow): void {
  const id = win.id
  appWindows.add(id)
  win.on("closed", () => appWindows.delete(id))
  win.on("focus", () => refreshMenu())
}

function saveWindowState(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return
  const maximized = win.isMaximized()
  const b = maximized ? (config.get().windowState ?? win.getNormalBounds()) : win.getBounds()
  config.update(
    (c) => {
      c.windowState = {
        ...c.windowState,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        isMaximized: maximized,
      }
    },
    { debounce: true },
  )
}

function createMainWindow(): BrowserWindow {
  const saved = config.get().windowState
  const bounds = restoreBounds(saved, screen.getAllDisplays().map((d) => d.workArea))
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 760,
    minHeight: 520,
    title: "NEU Research",
    icon: ICON,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: webPreferences(),
  })
  registerWindow(win)
  if (saved?.isMaximized) win.maximize()
  win.once("ready-to-show", () => {
    if (!process.env.NEU_DESKTOP_HIDDEN) win.show()
  })
  for (const ev of ["resize", "move", "maximize", "unmaximize"] as const) win.on(ev as "resize", () => saveWindowState(win))
  win.on("close", () => {
    saveWindowState(win)
    config.flush()
  })
  win.webContents.on("did-finish-load", () => {
    const z = config.get().windowState?.zoomLevel
    if (z !== undefined && isPortalUrl(win.webContents.getURL(), portal)) win.webContents.setZoomLevel(z)
  })
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null
  })
  void win.loadURL(portal.url)
  return win
}

function focusedContents(): WebContents | null {
  const w = BrowserWindow.getFocusedWindow() ?? mainWindow
  return w && !w.isDestroyed() ? w.webContents : null
}

function zoomBy(wc: WebContents, delta: number | "reset"): void {
  const level = delta === "reset" ? 0 : Math.max(-3, Math.min(4, wc.getZoomLevel() + delta))
  wc.setZoomLevel(level)
  config.update((c) => {
    if (c.windowState) c.windowState.zoomLevel = level
  }, { debounce: true })
}

function openPortalChild(url: string): void {
  const w = new BrowserWindow({ width: 1100, height: 800, icon: ICON, webPreferences: webPreferences() })
  registerWindow(w)
  void w.loadURL(url)
}

// ───────────────────────── Menu ─────────────────────────
function serverPresets(): { label: string; url: string }[] {
  const list = [{ label: "research.neu.edu.vn", url: "https://research.neu.edu.vn" }]
  if (isDev) list.push({ label: "localhost:3000 (phát triển)", url: "http://localhost:3000" })
  if (!list.some((p) => p.url === portal.url)) list.push({ label: portal.url.replace(/^https?:\/\//, ""), url: portal.url })
  return list
}

function refreshMenu(): void {
  if (!app.isReady()) return
  const wc = focusedContents()
  const pid = getActiveProject(wc)
  let linked = false
  if (pid) {
    try {
      linked = !!folders.get(pid)?.exists
    } catch {
      linked = false
    }
  }
  const menu = buildMenu(
    {
      locale: locale(),
      isMac: process.platform === "darwin",
      isDev,
      hasActiveProject: !!pid,
      activeProjectLinked: linked,
      currentServer: portal.url,
      serverPresets: serverPresets(),
    },
    {
      goHome: () => focusedContents()?.loadURL(portal.url),
      linkFolder: () => {
        const c = focusedContents()
        if (c && getActiveProject(c)) sendMenuCommand(c, "link-folder")
        else void infoBox(tr(locale(), "noProjectTitle"), tr(locale(), "noProjectDetail"))
      },
      revealFolder: () => {
        const p = getActiveProject(focusedContents())
        if (!p) return
        try {
          void shell.openPath(folders.resolveFolder(p))
        } catch {
          void infoBox(tr(locale(), "noProjectTitle"), tr(locale(), "noLinkedDetail"))
        }
      },
      switchServer: (url) => void switchServer(url),
      customServer: () => {
        config.flush()
        shell.showItemInFolder(config.file)
        void infoBox(tr(locale(), "server"), tr(locale(), "configHint"))
      },
      setLocale: (l) => {
        config.update((c) => {
          c.menuLocale = l
        })
        refreshMenu()
      },
      back: () => {
        const h = focusedContents()?.navigationHistory
        if (h?.canGoBack()) h.goBack()
      },
      forward: () => {
        const h = focusedContents()?.navigationHistory
        if (h?.canGoForward()) h.goForward()
      },
      reload: () => focusedContents()?.reload(),
      forceReload: () => focusedContents()?.reloadIgnoringCache(),
      zoom: (d) => {
        const c = focusedContents()
        if (c) zoomBy(c, d)
      },
      toggleDevTools: () => focusedContents()?.toggleDevTools(),
      openGuide: () => openPortalChild(`${portal.url}/huong-dan.html`),
      openWebsite: () => openExternal(portal.url),
      about: () =>
        void infoBox(
          tr(locale(), "aboutTitle"),
          tr(locale(), "aboutDetail", {
            version: app.getVersion(),
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            server: portal.url,
          }),
        ),
    },
  )
  Menu.setApplicationMenu(menu)
}

async function infoBox(title: string, detail: string): Promise<void> {
  const opts: Electron.MessageBoxOptions = { type: "info", title, message: title, detail, buttons: [tr(locale(), "ok")] }
  const w = BrowserWindow.getFocusedWindow()
  if (w) await dialog.showMessageBox(w, opts)
  else await dialog.showMessageBox(opts)
}

async function switchServer(url: string): Promise<void> {
  if (url === portal.url) return
  const next = parsePortalUrl(url)
  const w = BrowserWindow.getFocusedWindow()
  const opts: Electron.MessageBoxOptions = {
    type: "question",
    title: tr(locale(), "switchServerTitle"),
    message: tr(locale(), "switchServerTitle"),
    detail: tr(locale(), "switchServerDetail", { server: next.url }),
    buttons: [tr(locale(), "switchServerOk"), tr(locale(), "cancel")],
    defaultId: 0,
    cancelId: 1,
  }
  const res = w ? await dialog.showMessageBox(w, opts) : await dialog.showMessageBox(opts)
  if (res.response !== 0) return
  config.update((c) => {
    c.portalUrl = next.url
  })
  portal = next
  // Preload nhận origin qua tham số lúc tạo cửa sổ → tạo lại cửa sổ.
  for (const win of BrowserWindow.getAllWindows()) win.destroy()
  mainWindow = createMainWindow()
  refreshMenu()
}

// ───────────────────────── Vòng đời ứng dụng ─────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on("web-contents-created", (_e, wc) => guardWebContents(wc))

  void app.whenReady().then(() => {
    configureSession(session.fromPartition(PARTITION))
    // Phiên mặc định không dùng tới — vẫn từ chối mọi quyền cho chắc.
    session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    if (process.platform === "darwin" && app.dock && !app.isPackaged) app.dock.setIcon(ICON)
    mainWindow = createMainWindow()
    refreshMenu()
    console.info(`[neu] NEU Research ${app.getVersion()} — máy chủ ${portal.url}`)
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
  })

  app.on("before-quit", () => config.flush())
}
