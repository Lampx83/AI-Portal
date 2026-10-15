/** Khôi phục kích thước/vị trí cửa sổ, bảo đảm cửa sổ nằm trong một màn hình đang có (tránh mở ra ngoài khi rút màn hình phụ). */
import type { WindowState } from "./config"

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_SIZE = { width: 1320, height: 880 }

export function restoreBounds(saved: WindowState | undefined, workAreas: Rect[]): Partial<Rect> & { width: number; height: number } {
  if (!saved) return { ...DEFAULT_SIZE }
  const width = saved.width
  const height = saved.height
  if (saved.x === undefined || saved.y === undefined) return { width, height }
  const visible = workAreas.some((a) => {
    // Yêu cầu ít nhất 100×50 px của cửa sổ (thanh tiêu đề) nằm trong vùng làm việc.
    const ix = Math.min(saved.x! + width, a.x + a.width) - Math.max(saved.x!, a.x)
    const iy = Math.min(saved.y! + 50, a.y + a.height) - Math.max(saved.y!, a.y)
    return ix >= 100 && iy >= 30
  })
  return visible ? { x: saved.x, y: saved.y, width, height } : { width, height }
}
