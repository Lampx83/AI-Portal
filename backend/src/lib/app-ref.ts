/**
 * Reference to Express app and set of mounted agent paths (for runtime plugin mount).
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

/** Mount a router at path; returns true if mounted, false if path already mounted. */
export function mountPlugin(mountPath: string, router: Router): boolean {
  if (!appRef || !mountedSetRef) return false
  if (mountedSetRef.has(mountPath)) return false
  appRef.use(mountPath, router)
  mountedSetRef.add(mountPath)
  return true
}
