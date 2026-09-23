import { type ThreeEvent } from '@react-three/fiber'
import { UTILITY_COLORS, type Room, type Utility } from '@/domain/model'
import { mmToM } from '@/shared/lib/units'
import { utilityPoint, wallUtilityFrame } from '@/domain/room/utilities'
import { UtilityGeometry } from './UtilityGeometry'

/** Условная 3D-модель инженерного вывода на его высотной отметке. */
export function UtilityMarker({
  utility,
  room,
  selected,
  invalid,
  connected,
  onSelect,
}: {
  utility: Utility
  room: Room
  selected: boolean
  invalid: boolean
  connected: boolean
  onSelect: () => void
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect()
  }
  const color = invalid ? '#dc2626' : UTILITY_COLORS[utility.type]
  const point = utilityPoint(utility, room)
  const wallFrame = wallUtilityFrame(utility, room)
  const rotation = wallFrame ? Math.atan2(wallFrame.inward.x, wallFrame.inward.y) : 0

  return (
    <group
      position={[mmToM(point.x), mmToM(utility.height), mmToM(point.y)]}
      rotation={[0, rotation, 0]}
      onClick={handleClick}
    >
      <UtilityGeometry utility={utility} color={color} wallMounted={wallFrame !== null} />
      {(selected || invalid || connected) && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[mmToM(90), 16, 12]} />
          <meshBasicMaterial
            color={invalid ? '#dc2626' : connected ? '#059669' : '#2563eb'}
            transparent
            opacity={0.35}
            wireframe
          />
        </mesh>
      )}
    </group>
  )
}
