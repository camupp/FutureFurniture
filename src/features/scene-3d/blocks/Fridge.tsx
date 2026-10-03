import type { BlockParams } from '@/domain/model'
import { mmToM } from '@/shared/lib/units'

/** Эскиз отдельно стоящего холодильника: габарит, две дверцы и доступный фасад. */
export function Fridge({ width, height, depth, facadeColor }: BlockParams) {
  const w = mmToM(width)
  const h = mmToM(height)
  const d = mmToM(depth)
  const freezerHeight = h * 0.3
  const gap = mmToM(5)
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={facadeColor} roughness={0.4} metalness={0.12} />
      </mesh>
      <mesh position={[0, freezerHeight, d / 2 + mmToM(1)]} receiveShadow>
        <boxGeometry args={[w - mmToM(8), gap, mmToM(2)]} />
        <meshStandardMaterial color="#6b7280" roughness={0.5} />
      </mesh>
      <mesh position={[w / 2 - mmToM(55), freezerHeight / 2, d / 2 + mmToM(15)]} castShadow>
        <boxGeometry args={[mmToM(16), mmToM(120), mmToM(22)]} />
        <meshStandardMaterial color="#697586" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[w / 2 - mmToM(55), freezerHeight + mmToM(180), d / 2 + mmToM(15)]} castShadow>
        <boxGeometry args={[mmToM(16), mmToM(160), mmToM(22)]} />
        <meshStandardMaterial color="#697586" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}
