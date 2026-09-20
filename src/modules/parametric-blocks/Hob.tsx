import { mmToM } from '../../shared/utils/units'
import { BUILT_IN_FLANGE, type BlockParams } from '../../shared/types'

const HOB_PLATE = BUILT_IN_FLANGE.hob
const BODY_INSET = 80
const BURNER_RADIUS = 85

/**
 * Варочная панель. Локальный ноль — низ корпуса, стеклянная плита сверху.
 * Корпус уходит в вырез столешницы, над поверхностью остаётся только плита.
 */
export function Hob({ width, height, depth, facadeColor }: BlockParams) {
  const w = mmToM(width)
  const h = mmToM(height)
  const d = mmToM(depth)
  const plate = mmToM(HOB_PLATE)
  const inset = mmToM(BODY_INSET)
  const bodyHeight = Math.max(h - plate, mmToM(5))
  const radius = Math.min(mmToM(BURNER_RADIUS), w / 4.5, d / 4.5)

  return (
    <group>
      <mesh position={[0, bodyHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[w - inset, bodyHeight, d - inset]} />
        <meshStandardMaterial color="#4a4f57" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, bodyHeight + plate / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, plate, d]} />
        <meshStandardMaterial color={facadeColor} roughness={0.15} metalness={0.3} />
      </mesh>
      {[
        [-w / 4, -d / 4],
        [w / 4, -d / 4],
        [-w / 4, d / 4],
        [w / 4, d / 4],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, bodyHeight + plate + 0.001, z]}>
          <cylinderGeometry args={[radius, radius, 0.003, 16]} />
          <meshStandardMaterial color="#565b63" roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )
}
