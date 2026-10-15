/**
 * Preload chạy trong sandbox (không có Node đầy đủ, không require được tệp nội bộ).
 * Chỉ cấp `window.neuDesktop` khi trang thuộc ĐÚNG hệ thống đã cấu hình (origin + basePath),
 * và chỉ ở khung chính. Main process kiểm tra lại người gửi cho từng lệnh (phòng thủ nhiều lớp).
 *
 * Các tên kênh dưới đây phải khớp `CHANNELS` trong src/shared/api.ts (có kiểm thử đối chiếu).
 */
import { contextBridge, ipcRenderer } from "electron"
import type { FolderChangeEvent, MenuCommand, NeuDesktopApi } from "../shared/api"

function argValue(name: string): string {
  const prefix = `--${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : ""
}

const portalOrigin = argValue("neu-portal-origin")
const portalBasePath = argValue("neu-portal-base")
const appVersion = argValue("neu-app-version")

function isPortalPage(): boolean {
  try {
    if (window.top !== window) return false
    if (!portalOrigin || window.location.origin !== portalOrigin) return false
    const p = window.location.pathname
    return !portalBasePath || p === portalBasePath || p.startsWith(portalBasePath + "/")
  } catch {
    return false
  }
}

/** Gọi IPC, chuyển lỗi về dạng Error có thông điệp gọn (bỏ tiền tố "Error invoking remote method …"). */
async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
    throw new Error(msg)
  }
}

const folderListeners = new Map<string, Set<(e: FolderChangeEvent) => void>>()
const menuListeners = new Set<(c: MenuCommand) => void>()

ipcRenderer.on("neu:folder:changed", (_event, payload: FolderChangeEvent) => {
  const set = folderListeners.get(payload?.projectId)
  if (!set) return
  for (const cb of [...set]) {
    try {
      cb({ projectId: payload.projectId, paths: Array.isArray(payload.paths) ? payload.paths.map(String) : [] })
    } catch {
      /* lỗi trong callback của trang không làm hỏng preload */
    }
  }
})

ipcRenderer.on("neu:app:menu-command", (_event, command: MenuCommand) => {
  for (const cb of [...menuListeners]) {
    try {
      cb(command)
    } catch {
      /* bỏ qua */
    }
  }
})

const api: NeuDesktopApi = {
  isDesktop: true,
  version: appVersion,
  platform: process.platform,
  pickProjectFolder: () => call("neu:folder:pick"),
  linkProjectFolder: (projectId, path) => call("neu:folder:link", String(projectId), String(path)),
  getLinkedFolder: (projectId) => call("neu:folder:get", String(projectId)),
  unlinkProjectFolder: (projectId) => call("neu:folder:unlink", String(projectId)),
  listFiles: (projectId, subPath) => call("neu:folder:list", String(projectId), subPath == null ? "" : String(subPath)),
  readTextFile: (projectId, relPath) => call("neu:folder:read", String(projectId), String(relPath)),
  revealInFolder: (projectId, relPath) => call("neu:folder:reveal", String(projectId), relPath == null ? "" : String(relPath)),
  openFile: (projectId, relPath) => call("neu:folder:open", String(projectId), String(relPath)),
  onFolderChange(projectId, callback) {
    const id = String(projectId)
    if (typeof callback !== "function") return () => {}
    let set = folderListeners.get(id)
    if (!set) {
      set = new Set()
      folderListeners.set(id, set)
      void call("neu:folder:watch", id).catch(() => {})
    }
    set.add(callback)
    return () => {
      const s = folderListeners.get(id)
      if (!s) return
      s.delete(callback)
      if (s.size === 0) {
        folderListeners.delete(id)
        void call("neu:folder:unwatch", id).catch(() => {})
      }
    }
  },
  setActiveProject(projectId) {
    ipcRenderer.send("neu:app:active-project", projectId == null ? null : String(projectId))
  },
  onMenuCommand(callback) {
    if (typeof callback !== "function") return () => {}
    menuListeners.add(callback)
    return () => {
      menuListeners.delete(callback)
    }
  },
}

if (isPortalPage()) {
  contextBridge.exposeInMainWorld("neuDesktop", api)
}
