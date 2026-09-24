import type { FurnitureItem, Point } from '@/domain/model'

export type AlignmentGuide = { kind: 'front' | 'side' | 'contact'; targetId: string; start: Point; end: Point }

/** Guides describe the final constrained placement, not a snap that another constraint later cancelled. */
export function alignmentGuides(item: FurnitureItem, furniture: FurnitureItem[]): AlignmentGuide[] {
  const angle = (item.rotation * Math.PI) / 180
  const axis = { x: Math.cos(angle), y: Math.sin(angle) }
  const normal = { x: -axis.y, y: axis.x }
  const w = item.params.width / 2
  const d = item.params.depth / 2
  const world = (x: number, y: number): Point => ({
    x: item.position.x + axis.x * x + normal.x * y,
    y: item.position.y + axis.y * x + normal.y * y,
  })
  const candidates: (AlignmentGuide & { distance: number })[] = []
  for (const other of furniture) {
    if (other.id === item.id || other.type !== item.type || Math.abs(other.elevation - item.elevation) > 50) continue
    if (Math.cos(((other.rotation - item.rotation) * Math.PI) / 180) < 0.99999999) continue
    const dx = other.position.x - item.position.x
    const dy = other.position.y - item.position.y
    const x = dx * axis.x + dy * axis.y
    const y = dx * normal.x + dy * normal.y
    const ow = other.params.width / 2
    const od = other.params.depth / 2
    const distance = Math.hypot(dx, dy)
    const add = (kind: AlignmentGuide['kind'], start: Point, end: Point) =>
      candidates.push({ kind, targetId: other.id, start, end, distance })
    if (Math.abs(Math.abs(x) - w - ow) < 1 && Math.min(d, y + od) - Math.max(-d, y - od) > 1) {
      add('contact', world(Math.sign(x) * w, Math.max(-d, y - od)), world(Math.sign(x) * w, Math.min(d, y + od)))
    }
    if (Math.abs(y + od - d) < 1 && Math.abs(x) - w - ow <= 1000) {
      add('front', world(Math.min(-w, x - ow), d), world(Math.max(w, x + ow), d))
    }
    if (Math.abs(y) - d - od <= 1000) {
      for (const edge of [-w, w]) {
        if ([-ow, ow].some((otherEdge) => Math.abs(x + otherEdge - edge) < 1)) {
          add('side', world(edge, Math.min(-d, y - od)), world(edge, Math.max(d, y + od)))
        }
      }
    }
  }
  const rank = { contact: 0, front: 1, side: 2 }
  candidates.sort(
    (a, b) => rank[a.kind] - rank[b.kind] || a.distance - b.distance || a.targetId.localeCompare(b.targetId),
  )
  return candidates.slice(0, 3).map(({ distance: _distance, ...guide }) => guide)
}
