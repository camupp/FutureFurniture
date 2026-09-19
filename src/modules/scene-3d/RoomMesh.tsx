import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Point, Room, Wall } from '../../shared/types'
import { bounds, roomPolygon, wallAngle, wallCenter, wallLength } from '../../shared/utils/geometry'
import { mmToM } from '../../shared/utils/units'

const FADED_OPACITY = 0.1

export function RoomMesh({ room }: { room: Room }) {
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
        <WallMesh key={wall.id} wall={wall} height={room.wallHeight} roomCenter={box.center} />
      ))}
    </group>
  )
}

function WallMesh({ wall, height, roomCenter }: { wall: Wall; height: number; roomCenter: Point }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  const center = wallCenter(wall)
  const length = wallLength(wall)
  const angle = wallAngle(wall)

  /** Нормаль, направленная наружу помещения. */
  const outward = useMemo(() => {
    const normal = { x: -(wall.end.y - wall.start.y), y: wall.end.x - wall.start.x }
    const toOutside = { x: center.x - roomCenter.x, y: center.y - roomCenter.y }
    const sign = normal.x * toOutside.x + normal.y * toOutside.y >= 0 ? 1 : -1
    return { x: normal.x * sign, y: normal.y * sign }
  }, [wall.start, wall.end, center.x, center.y, roomCenter.x, roomCenter.y])

  // Стена между камерой и комнатой становится полупрозрачной — иначе обзор закрыт.
  useFrame(({ camera }) => {
    const material = materialRef.current
    if (!material) return
    const cameraPlan = { x: camera.position.x * 1000, y: camera.position.z * 1000 }
    const side = outward.x * (cameraPlan.x - center.x) + outward.y * (cameraPlan.y - center.y)
    const target = side > 0 ? FADED_OPACITY : 1
    material.opacity += (target - material.opacity) * 0.15
    material.depthWrite = material.opacity > 0.9
  })

  return (
    <mesh
      position={[mmToM(center.x), mmToM(height) / 2, mmToM(center.y)]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[mmToM(length), mmToM(height), mmToM(wall.thickness)]} />
      <meshStandardMaterial ref={materialRef} color="#eceff3" roughness={0.95} transparent />
    </mesh>
  )
}
