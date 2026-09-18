import { useMemo } from 'react'
import * as THREE from 'three'
import { mmToM } from '../../shared/utils/units'
import type { CabinetParams } from '../../shared/types'

const PLINTH_HEIGHT = 100
const PLINTH_INSET = 50
const FACADE_THICKNESS = 18
const FACADE_GAP = 3
const HANDLE_LENGTH = 128

/**
 * Напольный шкаф. Начало координат — центр по ширине, низ цоколя на полу,
 * фасад смотрит в сторону +z. Геометрия пересчитывается от параметров.
 */
export function Cabinet({ width, height, depth, facadeColor, onFloor = true }: CabinetParams & { onFloor?: boolean }) {
  const w = mmToM(width)
  const h = mmToM(height)
  const d = mmToM(depth)
  // Поднятый над полом блок — навесной, цоколя у него нет.
  const plinth = onFloor ? mmToM(PLINTH_HEIGHT) : 0
  const facadeThickness = mmToM(FACADE_THICKNESS)
  const gap = mmToM(FACADE_GAP)

  const bodyHeight = h - plinth
  const bodyDepth = d - facadeThickness
  const bodyCenterZ = -d / 2 + bodyDepth / 2

  // Цоколь утоплен под фасад — иначе торчит тёмной полосой по низу блока.
  const plinthDepth = d - mmToM(PLINTH_INSET)
  const plinthCenterZ = -d / 2 + plinthDepth / 2
  const plinthColor = useMemo(() => new THREE.Color(facadeColor).multiplyScalar(0.72), [facadeColor])

  const doorCount = width > 600 ? 2 : 1
  const doorWidth = (w - gap * (doorCount + 1)) / doorCount
  const doorHeight = bodyHeight - gap * 2
  const doorZ = d / 2 - facadeThickness / 2

  return (
    <group>
      {onFloor && (
        <mesh position={[0, plinth / 2, plinthCenterZ]} castShadow receiveShadow>
          <boxGeometry args={[w - gap * 2, plinth, plinthDepth]} />
          <meshStandardMaterial color={plinthColor} roughness={0.85} />
        </mesh>
      )}

      <mesh position={[0, plinth + bodyHeight / 2, bodyCenterZ]} castShadow receiveShadow>
        <boxGeometry args={[w, bodyHeight, bodyDepth]} />
        <meshStandardMaterial color="#d9d5cf" roughness={0.75} />
      </mesh>

      {Array.from({ length: doorCount }, (_, i) => {
        const doorX = -w / 2 + gap + doorWidth / 2 + i * (doorWidth + gap)
        const handleSide = doorCount === 1 ? 1 : i === 0 ? 1 : -1
        const handleX = doorX + handleSide * (doorWidth / 2 - mmToM(40))
        return (
          <group key={i}>
            <mesh position={[doorX, plinth + bodyHeight / 2, doorZ]} castShadow receiveShadow>
              <boxGeometry args={[doorWidth, doorHeight, facadeThickness]} />
              <meshStandardMaterial color={facadeColor} roughness={0.55} />
            </mesh>
            <mesh
              position={[handleX, plinth + bodyHeight - mmToM(120), d / 2 + mmToM(14)]}
              castShadow
            >
              <boxGeometry args={[mmToM(16), mmToM(HANDLE_LENGTH), mmToM(16)]} />
              <meshStandardMaterial color="#9aa3ad" metalness={0.75} roughness={0.35} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
