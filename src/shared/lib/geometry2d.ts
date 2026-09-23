export type Point2D = { x: number; y: number }

export const distance = (a: Point2D, b: Point2D) => Math.hypot(b.x - a.x, b.y - a.y)

export const snap = (value: number, step: number) => Math.round(value / step) * step

export const snapPoint = (p: Point2D, step: number): Point2D => ({ x: snap(p.x, step), y: snap(p.y, step) })

/** Притягивает точку к горизонтали или вертикали относительно `from` — углы по умолчанию 90°. */
export function orthoSnap(from: Point2D, to: Point2D): Point2D {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)
  return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
}

export function rotatePoint(p: Point2D, origin: Point2D, deg: number): Point2D {
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = p.x - origin.x
  const dy = p.y - origin.y
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos }
}

export function pointInPolygon(p: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crosses = a.y > p.y !== b.y > p.y
    if (crosses && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  center: Point2D
}

export function bounds(points: Point2D[]): Bounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, center: { x: 0, y: 0 } }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  }
}
