import { useMemo } from 'react'
import * as THREE from 'three'
import { type Room } from '@/domain/model'
import { roomPolygon } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { mmToM } from '@/shared/lib/units'
import { WallMesh } from './components/WallMesh'
import { UtilityMarker } from './components/UtilityMarker'

type RoomMeshProps = {
  room: Room
  selectedOpeningId?: string
  selectedUtilityId?: string
  invalidOpeningIds: Set<string>
  invalidUtilityIds: Set<string>
  connectedUtilityIds: Set<string>
  onSelectOpening: (id: string) => void
  onSelectUtility: (id: string) => void
}

export function RoomMesh({
  room,
  selectedOpeningId,
  selectedUtilityId,
  invalidOpeningIds,
  invalidUtilityIds,
  connectedUtilityIds,
  onSelectOpening,
  onSelectUtility,
}: RoomMeshProps) {
  const polygon = useMemo(() => roomPolygon(room.walls), [room.walls])
  const box = useMemo(() => bounds(polygon), [polygon])

  const floorShape = useMemo(() => {
    if (polygon.length < 3) return null
    const shape = new THREE.Shape()
    polygon.forEach((p, i) => {
      const x = mmToM(p.x)
      const y = mmToM(p.y)
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    })
    shape.closePath()
    return shape
  }, [polygon])

  return (
    <group>
      {floorShape ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <shapeGeometry args={[floorShape]} />
          <meshStandardMaterial color="#c9b7a4" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
          <planeGeometry args={[8, 8]} />
          <meshStandardMaterial color="#c9b7a4" roughness={0.9} />
        </mesh>
      )}

      {room.walls.map((wall) => (
        <WallMesh
          key={wall.id}
          wall={wall}
          walls={room.walls}
          height={room.wallHeight}
          roomCenter={box.center}
          openings={room.openings.filter((opening) => opening.wallId === wall.id)}
          selectedOpeningId={selectedOpeningId}
          invalidOpeningIds={invalidOpeningIds}
          onSelectOpening={onSelectOpening}
        />
      ))}

      {room.utilities.map((utility) => (
        <UtilityMarker
          key={utility.id}
          utility={utility}
          room={room}
          selected={selectedUtilityId === utility.id}
          invalid={invalidUtilityIds.has(utility.id)}
          connected={connectedUtilityIds.has(utility.id)}
          onSelect={() => onSelectUtility(utility.id)}
        />
      ))}
    </group>
  )
}
