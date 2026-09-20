import * as THREE from 'three'
import { mmToM } from '../../shared/utils/units'

/** Прямоугольный вырез в локальной системе блока, мм. */
export type Cutout = { x: number; z: number; width: number; depth: number }

/**
 * Горизонтальная плита с вырезами: столешница и крышка тумбы.
 * Низ плиты лежит на y = 0, центр по ширине в нуле, по глубине — в `centerZ`.
 */
export function buildSlab(
  width: number,
  depth: number,
  thickness: number,
  cutouts: Cutout[],
  centerZ = 0,
): THREE.ExtrudeGeometry {
  const w = mmToM(width)
  const d = mmToM(depth)
  const z0 = mmToM(centerZ)

  const shape = new THREE.Shape()
  shape.moveTo(-w / 2, z0 - d / 2)
  shape.lineTo(w / 2, z0 - d / 2)
  shape.lineTo(w / 2, z0 + d / 2)
  shape.lineTo(-w / 2, z0 + d / 2)
  shape.closePath()

  for (const cutout of cutouts) {
    const halfW = mmToM(cutout.width) / 2
    const halfD = mmToM(cutout.depth) / 2
    const x = mmToM(cutout.x)
    const z = mmToM(cutout.z)
    const hole = new THREE.Path()
    hole.moveTo(x - halfW, z - halfD)
    hole.lineTo(x + halfW, z - halfD)
    hole.lineTo(x + halfW, z + halfD)
    hole.lineTo(x - halfW, z + halfD)
    hole.closePath()
    shape.holes.push(hole)
  }

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: mmToM(thickness), bevelEnabled: false })
  // Экструзия идёт по +z; разворачиваем плиту в горизонт и поднимаем на её толщину.
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, mmToM(thickness), 0)
  return geometry
}

/** Прямоугольное отверстие в вертикальной панели, мм: центр и габариты. */
export type PanelHole = { x: number; y: number; width: number; height: number }

export type PanelSegment = { x: number; y: number; width: number; height: number }

/**
 * Разбивает вертикальную панель на прямоугольники вокруг проёмов. В отличие от
 * `Shape.holes`, корректно работает с дверью, которая касается нижней границы,
 * и с пересекающимися проёмами.
 */
export function panelSegments(width: number, height: number, holes: PanelHole[]): PanelSegment[] {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const clipped = holes.flatMap((hole) => {
    const minX = Math.max(-halfWidth, hole.x - hole.width / 2)
    const maxX = Math.min(halfWidth, hole.x + hole.width / 2)
    const minY = Math.max(-halfHeight, hole.y - hole.height / 2)
    const maxY = Math.min(halfHeight, hole.y + hole.height / 2)
    return maxX > minX && maxY > minY ? [{ minX, maxX, minY, maxY }] : []
  })
  const uniqueSorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b)
  const xs = uniqueSorted([-halfWidth, halfWidth, ...clipped.flatMap((hole) => [hole.minX, hole.maxX])])
  const ys = uniqueSorted([-halfHeight, halfHeight, ...clipped.flatMap((hole) => [hole.minY, hole.maxY])])
  const segments: PanelSegment[] = []

  for (let ix = 0; ix < xs.length - 1; ix++) {
    for (let iy = 0; iy < ys.length - 1; iy++) {
      const minX = xs[ix]
      const maxX = xs[ix + 1]
      const minY = ys[iy]
      const maxY = ys[iy + 1]
      const x = (minX + maxX) / 2
      const y = (minY + maxY) / 2
      const insideHole = clipped.some(
        (hole) => x > hole.minX && x < hole.maxX && y > hole.minY && y < hole.maxY,
      )
      if (!insideHole) segments.push({ x, y, width: maxX - minX, height: maxY - minY })
    }
  }

  return segments
}

/**
 * Вертикальная панель с отверстиями: стена с проёмами, рама окна.
 * Контур строится в плоскости «ширина × высота» с нулём в центре,
 * толщина уходит по обе стороны от плоскости панели.
 */
export function buildPanel(
  width: number,
  height: number,
  thickness: number,
  holes: PanelHole[],
): THREE.ExtrudeGeometry {
  const w = mmToM(width)
  const h = mmToM(height)

  const shape = new THREE.Shape()
  shape.moveTo(-w / 2, -h / 2)
  shape.lineTo(w / 2, -h / 2)
  shape.lineTo(w / 2, h / 2)
  shape.lineTo(-w / 2, h / 2)
  shape.closePath()

  for (const hole of holes) {
    if (hole.width <= 0 || hole.height <= 0) continue
    const halfW = mmToM(hole.width) / 2
    const halfH = mmToM(hole.height) / 2
    const x = mmToM(hole.x)
    const y = mmToM(hole.y)
    const path = new THREE.Path()
    path.moveTo(x - halfW, y - halfH)
    path.lineTo(x + halfW, y - halfH)
    path.lineTo(x + halfW, y + halfH)
    path.lineTo(x - halfW, y + halfH)
    path.closePath()
    shape.holes.push(path)
  }

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: mmToM(thickness), bevelEnabled: false })
  geometry.translate(0, 0, -mmToM(thickness) / 2)
  return geometry
}
