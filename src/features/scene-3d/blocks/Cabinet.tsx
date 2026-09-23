import { CABINET_FACADE_GAP, innerFacadeSeamFootprint } from '../geometry/cabinetSeams'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mmToM } from '@/shared/lib/units'
import type { BlockParams } from '@/domain/model'
import {
  CABINET_PLINTH_INSET,
  CABINET_PLINTH_JOIN_OVERLAP,
  type CabinetFrontInterval,
  type CabinetFrontLayout,
} from '@/domain/assemblies/cabinetJoints'
import { buildSlab, type Cutout } from './slab'

const PLINTH_HEIGHT = 100
const FACADE_THICKNESS = 18
const HANDLE_LENGTH = 128
const CARCASS_COLOR = '#d9d5cf'
const OUTER_SEAM_COVER_THICKNESS = 1
const OUTER_PLINTH_SEAM_COVER_WIDTH = 6

/**
 * Напольный шкаф. Начало координат — центр по ширине, низ цоколя на полу,
 * фасад смотрит в сторону +z. Геометрия пересчитывается от параметров.
 */
export function Cabinet({
  width,
  height,
  depth,
  facadeColor,
  onFloor = true,
  cutouts = [],
  frontLayout,
}: BlockParams & { onFloor?: boolean; cutouts?: Cutout[]; frontLayout?: CabinetFrontLayout }) {
  const w = mmToM(width)
  const h = mmToM(height)
  const d = mmToM(depth)
  // Поднятый над полом блок — навесной, цоколя у него нет.
  const plinth = onFloor ? mmToM(PLINTH_HEIGHT) : 0
  const facadeThickness = mmToM(FACADE_THICKNESS)
  const gap = mmToM(CABINET_FACADE_GAP)

  const bodyHeight = h - plinth

  // Цоколь утоплен под фасад — иначе торчит тёмной полосой по низу блока.
  const plinthDepth = d - mmToM(CABINET_PLINTH_INSET)
  const plinthCenterZ = -d / 2 + plinthDepth / 2
  const plinthColor = useMemo(() => new THREE.Color(facadeColor).multiplyScalar(0.72), [facadeColor])

  /**
   * Корпус — призма со сквозной шахтой под врезную технику. Обычная коробка своей
   * верхней гранью перекрывала бы чашу мойки, стоящей внутри тумбы.
   */
  const carcassGeometry = useMemo(
    () =>
      buildSlab(
        width,
        depth - FACADE_THICKNESS,
        height - (onFloor ? PLINTH_HEIGHT : 0),
        cutouts,
        -depth / 2 + (depth - FACADE_THICKNESS) / 2,
      ),
    [width, height, depth, onFloor, cutouts],
  )
  useEffect(() => () => carcassGeometry.dispose(), [carcassGeometry])

  const doorHeight = bodyHeight - gap * 2
  const doorZ = d / 2 - facadeThickness / 2
  // У напольного шкафа ручка вверху дверцы, у навесного — внизу: до неё надо дотянуться.
  const handleY = onFloor ? plinth + bodyHeight - mmToM(120) : plinth + mmToM(120)

  const visibleIntervals: CabinetFrontInterval[] = frontLayout?.visible ?? [{ start: -width / 2, end: width / 2 }]
  const blockedIntervals = frontLayout?.blocked ?? []
  const plinthInterval = frontLayout?.plinth ?? {
    start: -width / 2,
    end: width / 2,
  }
  const plinthWidth = mmToM(plinthInterval.end - plinthInterval.start)
  const plinthCenterX = mmToM((plinthInterval.start + plinthInterval.end) / 2)

  return (
    <group>
      {onFloor && (
        <mesh position={[plinthCenterX, plinth / 2, plinthCenterZ]} castShadow receiveShadow>
          <boxGeometry args={[plinthWidth, plinth, plinthDepth]} />
          <meshStandardMaterial color={plinthColor} roughness={0.85} />
        </mesh>
      )}

      <mesh geometry={carcassGeometry} position={[0, plinth, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={CARCASS_COLOR} roughness={0.75} />
      </mesh>

      {frontLayout?.outerSeams.map((side) => {
        const direction = side === 'left' ? -1 : 1
        const coverThickness = mmToM(OUTER_SEAM_COVER_THICKNESS)
        const bodyCoverWidth = facadeThickness + gap * 2
        const plinthCoverWidth = mmToM(OUTER_PLINTH_SEAM_COVER_WIDTH)
        const x = direction * (w / 2 + coverThickness / 2)
        return (
          <group key={`outer-seam-${side}`}>
            {onFloor && (
              <mesh
                position={[x, plinth / 2, d / 2 - mmToM(CABINET_PLINTH_INSET) - mmToM(CABINET_PLINTH_JOIN_OVERLAP) / 2]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[coverThickness, plinth, plinthCoverWidth]} />
                <meshStandardMaterial color={plinthColor} roughness={0.85} />
              </mesh>
            )}
            <mesh position={[x, plinth + bodyHeight / 2, doorZ]} castShadow receiveShadow>
              <boxGeometry args={[coverThickness, bodyHeight, bodyCoverWidth]} />
              <meshStandardMaterial color={CARCASS_COLOR} roughness={0.75} />
            </mesh>
          </group>
        )
      })}

      {blockedIntervals.map((interval, index) => {
        const start = interval.start > -width / 2 ? interval.start - CABINET_FACADE_GAP : interval.start
        const end = interval.end < width / 2 ? interval.end + CABINET_FACADE_GAP : interval.end
        return (
          <mesh
            key={`top-join-${index}`}
            position={[mmToM((start + end) / 2), h - gap / 2, d / 2 - facadeThickness / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[mmToM(end - start), gap, facadeThickness]} />
            <meshStandardMaterial color={CARCASS_COLOR} roughness={0.75} />
          </mesh>
        )
      })}

      {frontLayout?.innerSeams.map((seam) => {
        const footprint = innerFacadeSeamFootprint(seam, depth, FACADE_THICKNESS)
        return (
          <mesh
            key={`inner-seam-${seam.side}`}
            position={[
              mmToM((footprint.x.start + footprint.x.end) / 2),
              plinth + bodyHeight / 2,
              mmToM((footprint.z.start + footprint.z.end) / 2),
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry
              args={[
                mmToM(footprint.x.end - footprint.x.start),
                doorHeight,
                mmToM(footprint.z.end - footprint.z.start),
              ]}
            />
            <meshStandardMaterial color={facadeColor} roughness={0.55} />
          </mesh>
        )
      })}

      {visibleIntervals.flatMap((interval, intervalIndex) => {
        const intervalWidth = interval.end - interval.start
        const doorCount = intervalWidth > 600 ? 2 : 1
        const doorWidth = (mmToM(intervalWidth) - gap * (doorCount + 1)) / doorCount
        return Array.from({ length: doorCount }, (_, doorIndex) => {
          const doorX = mmToM(interval.start) + gap + doorWidth / 2 + doorIndex * (doorWidth + gap)
          const handleSide = doorCount === 1 ? 1 : doorIndex === 0 ? 1 : -1
          const handleX = doorX + handleSide * (doorWidth / 2 - mmToM(40))
          return (
            <group key={`door-${intervalIndex}-${doorIndex}`}>
              <mesh position={[doorX, plinth + bodyHeight / 2, doorZ]} castShadow receiveShadow>
                <boxGeometry args={[doorWidth, doorHeight, facadeThickness]} />
                <meshStandardMaterial color={facadeColor} roughness={0.55} />
              </mesh>
              <mesh position={[handleX, handleY, d / 2 + mmToM(14)]} castShadow>
                <boxGeometry args={[mmToM(16), mmToM(HANDLE_LENGTH), mmToM(16)]} />
                <meshStandardMaterial color="#9aa3ad" metalness={0.75} roughness={0.35} />
              </mesh>
            </group>
          )
        })
      })}
    </group>
  )
}
