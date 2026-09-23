import { type ThreeEvent } from '@react-three/fiber'
import { type Opening, type Wall } from '@/domain/model'
import { clampOffset } from '@/domain/room/openings'
import { mmToM } from '@/shared/lib/units'

const FRAME_THICKNESS = 50

/** Рама проёма, а у окна ещё и стекло. Координаты — в плоскости стены. */
export function OpeningMesh({
  opening,
  wall,
  wallLength: length,
  wallHeight,
  selected,
  invalid,
  onSelect,
}: {
  opening: Opening
  wall: Wall
  wallLength: number
  wallHeight: number
  selected: boolean
  invalid: boolean
  onSelect: () => void
}) {
  const x = mmToM(clampOffset(opening, wall) - length / 2)
  const openingHeight = Math.min(opening.height, wallHeight - opening.sill)
  const y = mmToM(opening.sill + openingHeight / 2 - wallHeight / 2)
  const w = mmToM(opening.width)
  const h = mmToM(openingHeight)
  const frameSize = Math.min(FRAME_THICKNESS, opening.width / 4, openingHeight / 4)
  const frame = mmToM(frameSize)
  const depth = mmToM(wall.thickness) * 0.5
  const frameDepth = mmToM(wall.thickness + 20)
  const frameColor = invalid ? '#dc2626' : selected ? '#2563eb' : '#f4f5f7'

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect()
  }
  return (
    <group position={[x, y, 0]} onClick={handleClick}>
      <mesh position={[-w / 2 + frame / 2, 0, 0]} castShadow>
        <boxGeometry args={[frame, h, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      <mesh position={[w / 2 - frame / 2, 0, 0]} castShadow>
        <boxGeometry args={[frame, h, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, h / 2 - frame / 2, 0]} castShadow>
        <boxGeometry args={[Math.max(frame, w - frame * 2), frame, frameDepth]} />
        <meshStandardMaterial color={frameColor} roughness={0.6} />
      </mesh>
      {opening.type === 'window' && (
        <mesh position={[0, -h / 2 + frame / 2, 0]} castShadow>
          <boxGeometry args={[Math.max(frame, w - frame * 2), frame, frameDepth]} />
          <meshStandardMaterial color={frameColor} roughness={0.6} />
        </mesh>
      )}

      {opening.type === 'window' && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w - frame * 2, h - frame * 2, mmToM(6)]} />
          <meshStandardMaterial color="#bcd7e6" transparent opacity={0.35} roughness={0.1} metalness={0.1} />
        </mesh>
      )}

      {opening.type === 'door' && (
        <mesh position={[0, -frame / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[Math.max(frame, w - frame * 2), Math.max(frame, h - frame), mmToM(35)]} />
          <meshStandardMaterial color="#c9a77e" roughness={0.75} />
        </mesh>
      )}

      {opening.type === 'window' && (
        <mesh position={[0, -h / 2 - mmToM(15), depth * 0.3]} castShadow receiveShadow>
          <boxGeometry args={[w + mmToM(60), mmToM(30), mmToM(wall.thickness) + depth * 0.6]} />
          <meshStandardMaterial color="#e7e5e1" roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}
