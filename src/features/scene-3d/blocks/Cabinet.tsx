import { CABINET_FACADE_GAP, innerFacadeSeamFootprint } from '../geometry/cabinetSeams'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mmToM } from '@/shared/lib/units'
import type { BlockParams, CabinetModule } from '@/domain/model'
import {
  CABINET_PLINTH_INSET,
  CABINET_PLINTH_JOIN_OVERLAP,
  type CabinetFrontLayout,
} from '@/domain/assemblies/cabinetJoints'
import { CABINET_PLINTH_HEIGHT, cabinetFacePanels } from '@/domain/assemblies/cabinetFaces'
import { buildSlab, type Cutout } from './slab'

const FACADE_THICKNESS = 18
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
  module,
}: BlockParams & {
  onFloor?: boolean
  cutouts?: Cutout[]
  frontLayout?: CabinetFrontLayout
  module: CabinetModule
}) {
  const w = mmToM(width)
  const h = mmToM(height)
  const d = mmToM(depth)
  // Поднятый над полом блок — навесной, цоколя у него нет.
  const plinth = onFloor ? mmToM(CABINET_PLINTH_HEIGHT) : 0
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
        height - (onFloor ? CABINET_PLINTH_HEIGHT : 0),
        cutouts,
        -depth / 2 + (depth - FACADE_THICKNESS) / 2,
      ),
    [width, height, depth, onFloor, cutouts],
  )
  useEffect(() => () => carcassGeometry.dispose(), [carcassGeometry])

  const doorHeight = bodyHeight - gap * 2
  const doorZ = d / 2 - facadeThickness / 2
  const panels = cabinetFacePanels(width, height, onFloor, frontLayout?.visible, module)
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

      {panels.map((panel, index) => {
        const panelWidth = panel.right - panel.left
        const appliance = panel.kind === 'oven' || panel.kind === 'dishwasher'
        return (
          <group key={`panel-${index}`}>
            <mesh
              position={[mmToM((panel.left + panel.right) / 2), mmToM((panel.bottom + panel.top) / 2), doorZ]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[mmToM(panelWidth), mmToM(panel.top - panel.bottom), facadeThickness]} />
              <meshStandardMaterial
                color={panel.kind === 'oven' ? '#252c36' : panel.kind === 'dishwasher' ? '#aeb8c2' : facadeColor}
                metalness={appliance ? 0.35 : 0}
                roughness={appliance ? 0.35 : 0.55}
              />
            </mesh>
            {panel.kind === 'oven' && (
              <mesh
                position={[
                  mmToM((panel.left + panel.right) / 2),
                  mmToM((panel.bottom + panel.top) / 2 - 25),
                  d / 2 + mmToM(1),
                ]}
                castShadow
              >
                <boxGeometry args={[mmToM(panelWidth * 0.76), mmToM((panel.top - panel.bottom) * 0.58), mmToM(2)]} />
                <meshStandardMaterial color="#101820" metalness={0.25} roughness={0.18} />
              </mesh>
            )}
            {panel.kind === 'dishwasher' && (
              <mesh position={[mmToM((panel.left + panel.right) / 2), mmToM(panel.top - 65), d / 2 + mmToM(1)]}>
                <boxGeometry args={[mmToM(panelWidth - 40), mmToM(40), mmToM(2)]} />
                <meshStandardMaterial color="#525e6b" metalness={0.45} roughness={0.4} />
              </mesh>
            )}
            {panel.handleStyle === 'knob' ? (
              <mesh
                position={[mmToM(panel.handleX), mmToM(panel.handleY), d / 2 + mmToM(10)]}
                rotation={[Math.PI / 2, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[mmToM(16), mmToM(16), mmToM(18), 20]} />
                <meshStandardMaterial color="#9aa3ad" metalness={0.75} roughness={0.35} />
              </mesh>
            ) : (
              <mesh position={[mmToM(panel.handleX), mmToM(panel.handleY), d / 2 + mmToM(14)]} castShadow>
                <boxGeometry args={[mmToM(panel.handleWidth), mmToM(panel.handleHeight), mmToM(16)]} />
                <meshStandardMaterial color="#9aa3ad" metalness={0.75} roughness={0.35} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}
