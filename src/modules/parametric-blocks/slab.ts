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
