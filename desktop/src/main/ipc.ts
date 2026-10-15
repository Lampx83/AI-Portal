/**
 * Cầu nối IPC cho `window.neuDesktop`. Mọi lệnh đều:
 *  1. chỉ nhận từ khung CHÍNH của cửa sổ do ứng dụng tạo,
 *  2. khung đó phải đang ở trang thuộc hệ thống đã cấu hình (origin + basePath),
 *  3. tham số được kiểm tra lại trong ProjectFolderService / pathGuard.
 */
import { BrowserWindow, dialog, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from "electron"
import fs from "fs"
import { CHANNELS, type FolderChangeEvent, type MenuCommand } from "../shared/api"
import { isPortalUrl, type PortalTarget } from "./policy"
import { assertProjectId, type ProjectFolderService } from "./projectFolders"
import { watchFolder, type WatchHandle } from "./watcher"

export interface IpcDeps {
  folders: ProjectFolderService
  getPortal: () => PortalTarget
  /** Cửa sổ có phải do ứng dụng tạo không. */
  isAppWindow: (wc: WebContents) => boolean
  showOpenDialog: (win: BrowserWindow | null) => Promise<string | null>
  openPath: (absPath: string) => Promise<string>
  showItemInFolder: (absPath: string) => void
  onActiveProjectChanged: () => void
}

/** Thư mục người dùng vừa chọn qua hộp thoại — chỉ những đường dẫn này mới được liên kết. */
const PICK_TTL_MS = 10 * 60 * 1000
const picked = new Map<number, { path: string; at: number }>()
const watchers = new Map<number, Map<string, WatchHandle>>()
const activeProject = new Map<number, string | null>()
const tracked = new Set<number>()

function assertPortalSender(e: IpcMainInvokeEvent | IpcMainEvent, deps: IpcDeps): void {
  const frame = e.senderFrame
  if (!frame || frame !== e.sender.mainFrame) throw new Error("Không được phép: chỉ trang chính của hệ thống mới dùng được tính năng này")
  if (!deps.isAppWindow(e.sender)) throw new Error("Không được phép: cửa sổ lạ")
  if (!isPortalUrl(frame.url, deps.getPortal())) throw new Error("Không được phép: trang không thuộc hệ thống")
}

function closeWatchers(wcId: number): void {
  const m = watchers.get(wcId)
  if (!m) return
  for (const h of m.values()) h.close()
  watchers.delete(wcId)
}

/** Dọn trạng thái khi trang điều hướng sang tài liệu khác hoặc cửa sổ đóng. */
function track(wc: WebContents, deps: IpcDeps): void {
  if (tracked.has(wc.id)) return
  tracked.add(wc.id)
  const id = wc.id
  wc.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) {
      closeWatchers(id)
      picked.delete(id)
      if (activeProject.get(id)) {
        activeProject.set(id, null)
        deps.onActiveProjectChanged()
      }
    }
  })
  wc.once("destroyed", () => {
    closeWatchers(id)
    picked.delete(id)
    activeProject.delete(id)
    tracked.delete(id)
    deps.onActiveProjectChanged()
  })
}

export function getActiveProject(wc: WebContents | undefined | null): string | null {
  if (!wc) return null
  return activeProject.get(wc.id) ?? null
}

export function sendMenuCommand(wc: WebContents, command: MenuCommand): void {
  wc.send(CHANNELS.menuCommand, command)
}

export function registerIpc(deps: IpcDeps): void {
  const handle = (channel: string, fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => {
    ipcMain.handle(channel, async (e, ...args) => {
      assertPortalSender(e, deps)
      track(e.sender, deps)
      return fn(e, ...args)
    })
  }

  handle(CHANNELS.pickFolder, async (e) => {
    const dir = await deps.showOpenDialog(BrowserWindow.fromWebContents(e.sender))
    if (!dir) return null
    const real = deps.folders.validateFolderChoice(dir)
    picked.set(e.sender.id, { path: real, at: Date.now() })
    return real
  })

  handle(CHANNELS.link, (e, projectId, dir) => {
    const p = picked.get(e.sender.id)
    let real = ""
    try {
      real = typeof dir === "string" ? fs.realpathSync.native(dir) : ""
    } catch {
      /* để trống → bị từ chối bên dưới */
    }
    if (!p || Date.now() - p.at > PICK_TTL_MS || !real || p.path !== real) {
      throw new Error("Chỉ liên kết được thư mục bạn vừa chọn trong hộp thoại của hệ điều hành")
    }
    picked.delete(e.sender.id)
    const info = deps.folders.link(projectId, real)
    // Đổi thư mục → khởi động lại theo dõi nếu trang đang theo dõi dự án này.
    const m = watchers.get(e.sender.id)
    const id = String(projectId)
    if (m?.has(id)) {
      m.get(id)!.close()
      m.delete(id)
      startWatch(e.sender, id)
    }
    deps.onActiveProjectChanged()
    return info
  })

  handle(CHANNELS.getLinked, (_e, projectId) => deps.folders.get(projectId))

  handle(CHANNELS.unlink, (e, projectId) => {
    const id = assertProjectId(projectId)
    const m = watchers.get(e.sender.id)
    m?.get(id)?.close()
    m?.delete(id)
    const ok = deps.folders.unlink(id)
    deps.onActiveProjectChanged()
    return ok
  })

  handle(CHANNELS.list, (_e, projectId, subPath) => deps.folders.listFiles(projectId, subPath))
  handle(CHANNELS.read, (_e, projectId, relPath) => deps.folders.readTextFile(projectId, relPath))

  handle(CHANNELS.reveal, async (_e, projectId, relPath) => {
    const abs = deps.folders.resolveForReveal(projectId, relPath)
    if (!relPath) {
      const err = await deps.openPath(abs)
      if (err) throw new Error(err)
    } else {
      deps.showItemInFolder(abs)
    }
  })

  handle(CHANNELS.open, async (_e, projectId, relPath) => {
    const abs = deps.folders.resolveForOpen(projectId, relPath)
    const err = await deps.openPath(abs)
    if (err) throw new Error(err)
  })

  const startWatch = (wc: WebContents, id: string) => {
    let root: string
    try {
      root = deps.folders.resolveFolder(id)
    } catch {
      return false
    }
    let m = watchers.get(wc.id)
    if (!m) {
      m = new Map()
      watchers.set(wc.id, m)
    }
    if (m.has(id)) return true
    m.set(
      id,
      watchFolder(root, (paths) => {
        if (wc.isDestroyed()) return
        const payload: FolderChangeEvent = { projectId: id, paths }
        wc.send(CHANNELS.changed, payload)
      }),
    )
    return true
  }

  handle(CHANNELS.watch, (e, projectId) => startWatch(e.sender, assertProjectId(projectId)))

  handle(CHANNELS.unwatch, (e, projectId) => {
    const id = assertProjectId(projectId)
    const m = watchers.get(e.sender.id)
    m?.get(id)?.close()
    m?.delete(id)
    return true
  })

  ipcMain.on(CHANNELS.setActiveProject, (e, projectId: unknown) => {
    try {
      assertPortalSender(e, deps)
      track(e.sender, deps)
      activeProject.set(e.sender.id, projectId == null ? null : assertProjectId(projectId))
      deps.onActiveProjectChanged()
    } catch {
      /* bỏ qua lệnh không hợp lệ */
    }
  })
}
