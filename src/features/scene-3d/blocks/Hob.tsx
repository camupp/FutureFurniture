import { mmToM } from '@/shared/lib/units'
import { BUILT_IN_FLANGE, type BlockParams, type HobConnection } from '@/domain/model'

const HOB_PLATE = BUILT_IN_FLANGE.hob
const BODY_INSET = 80
const BURNER_RADIUS = 85

/**
 * Кухонная плита. Локальный ноль — низ корпуса, стеклянная поверхность сверху.
 * Корпус уходит в вырез столешницы, над поверхностью остаётся только плита.
 */
export function Hob({
  width,
  height,
  depth,
  facadeColor,
  connection = 'unknown',
}: BlockParams & { connection?: HobConnection }) {
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
        <group key={i} position={[x, bodyHeight + plate + 0.001, z]}>
          <mesh>
            <cylinderGeometry args={[radius, radius, 0.003, 24]} />
            <meshStandardMaterial
              color={connection === 'gas' ? '#8f969e' : '#565b63'}
              roughness={0.5}
              metalness={0.6}
            />
          </mesh>
          {connection === 'gas' && (
            <mesh position={[0, 0.003, 0]}>
              <cylinderGeometry args={[radius * 0.52, radius * 0.52, 0.004, 24]} />
              <meshStandardMaterial color="#20252c" roughness={0.45} metalness={0.4} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}
