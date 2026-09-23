import { describe, expect, it } from 'vitest'
import { wallPanelGeometry } from '@/features/scene-3d/geometry/wallPanels'

describe('wallPanelGeometry', () => {
  const profile = {
    start: { left: 50, right: -50 },
    end: { left: -50, right: 50 },
  }

  it('uses the mitered footprint at both ends of a full wall panel', () => {
    const geometry = wallPanelGeometry({ x: 0, y: 0, width: 1000, height: 2700 }, 1000, 100, profile)
    const points = new Set<string>()
    const positions = geometry.getAttribute('position')
    for (let index = 0; index < positions.count; index++) {
      const x = Math.round(positions.getX(index) * 1000)
      const z = Math.round(positions.getZ(index) * 1000)
      points.add(`${x}:${z}`)
    }

    expect(points).toEqual(new Set(['-450:50', '450:50', '550:-50', '-550:-50']))
    geometry.dispose()
  })

  it('keeps an opening-adjacent section cut square inside the wall', () => {
    const geometry = wallPanelGeometry({ x: -250, y: 0, width: 500, height: 2700 }, 1000, 100, profile)
    geometry.computeBoundingBox()

    expect(geometry.boundingBox?.max.x).toBeCloseTo(0)
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-0.55)
    geometry.dispose()
  })
})
