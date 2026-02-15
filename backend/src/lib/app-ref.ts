/**
 * Tham chiếu tới Express app và set đường dẫn agent đã mount (dùng cho mount plugin tại runtime).
 */
import type { Express, Router } from "express"

let appRef: Express | null = null
let mountedSetRef: Set<string> | null = null

export function setApp(app: Express, mountedPaths: Set<string>): void {
  appRef = app
  mountedSetRef = mountedPaths
}

export function getApp(): Express | null {
  return appRef
}

export function getMountedPaths(): Set<string> | null {
  return mountedSetRef
}

/** Mount một router tại path; trả về true nếu mount thành công, false nếu path đã được mount. */
export function mountPlugin(mountPath: string, router: Router): boolean {
  if (!appRef || !mountedSetRef) return false
  if (mountedSetRef.has(mountPath)) return false
  appRef.use(mountPath, router)
  mountedSetRef.add(mountPath)
  return true
}
