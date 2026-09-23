import * as THREE from 'three'
import type { WallJunctionProfile } from '@/domain/geometry/wallJunctions'
import { mmToM } from '@/shared/lib/units'
import type { PanelSegment } from '../blocks/slab'

/** A panel inherits the wall's miter only when it touches that wall endpoint. */
export function wallPanelGeometry(
  segment: PanelSegment,
  wallLength: number,
  thickness: number,
  profile: WallJunctionProfile,
): THREE.ExtrudeGeometry {
  const start = segment.x - segment.width / 2
  const end = segment.x + segment.width / 2
  const startsWall = Math.abs(start + wallLength / 2) < 0.01
  const endsWall = Math.abs(end - wallLength / 2) < 0.01
  const leftStart = start + (startsWall ? profile.start.left : 0)
  const rightStart = start + (startsWall ? profile.start.right : 0)
  const leftEnd = end + (endsWall ? profile.end.left : 0)
  const rightEnd = end + (endsWall ? profile.end.right : 0)
  const half = mmToM(thickness / 2)
  const shape = new THREE.Shape()
  shape.moveTo(mmToM(leftStart), half)
  shape.lineTo(mmToM(leftEnd), half)
  shape.lineTo(mmToM(rightEnd), -half)
  shape.lineTo(mmToM(rightStart), -half)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: mmToM(segment.height), bevelEnabled: false })
  geometry.rotateX(Math.PI / 2)
  geometry.translate(0, mmToM(segment.y + segment.height / 2), 0)
  return geometry
}
