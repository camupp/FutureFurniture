import { useEffect, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { UTILITY_COLORS, type Opening, type Point, type Room, type Utility, type Wall } from '../../shared/types'
import { bounds, roomPolygon, wallAngle, wallCenter, wallLength } from '../../shared/utils/geometry'
import { clampOffset } from '../../shared/utils/openings'
import { mmToM } from '../../shared/utils/units'
import { utilityPoint, wallUtilityFrame } from '../../shared/utils/utilities'
import { panelSegments } from '../parametric-blocks/slab'

const FADED_OPACITY = 0.1
const FRAME_THICKNESS = 50

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

type WallMeshProps = {
  wall: Wall
  height: number
  roomCenter: Point
  openings: Opening[]
  selectedOpeningId?: string
  invalidOpeningIds: Set<string>
  onSelectOpening: (id: string) => void
}

function WallMesh({
  wall,
  height,
  roomCenter,
  openings,
  selectedOpeningId,
  invalidOpeningIds,
  onSelectOpening,
}: WallMeshProps) {
  const center = wallCenter(wall)
  const length = wallLength(wall)
  const angle = wallAngle(wall)

  /**
   * Стена строится экструзией контура с дырками под проёмы, а не боксом.
   * Контур живёт в плоскости «длина × высота», ноль — в центре стены.
   * Для прямоугольных проёмов такой триангуляции хватает; на сложных формах
   * пришлось бы переходить на CSG.
   */
  const segments = useMemo(() => {
    const cutouts = openings.map((opening) => ({
      x: clampOffset(opening, wall) - length / 2,
      y: opening.sill + opening.height / 2 - height / 2,
      width: opening.width,
      height: Math.min(opening.height, height - opening.sill),
    }))
    return panelSegments(length, height, cutouts)
  }, [wall, length, height, openings])

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#eceff3', roughness: 0.95, transparent: true }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  /** Нормаль, направленная наружу помещения. */
  const outward = useMemo(() => {
    const normal = { x: -(wall.end.y - wall.start.y), y: wall.end.x - wall.start.x }
    const toOutside = { x: center.x - roomCenter.x, y: center.y - roomCenter.y }
    const sign = normal.x * toOutside.x + normal.y * toOutside.y >= 0 ? 1 : -1
    return { x: normal.x * sign, y: normal.y * sign }
  }, [wall.start, wall.end, center.x, center.y, roomCenter.x, roomCenter.y])

  // Стена между камерой и комнатой становится полупрозрачной — иначе обзор закрыт.
  useFrame(({ camera }) => {
    const cameraPlan = { x: camera.position.x * 1000, y: camera.position.z * 1000 }
    const side = outward.x * (cameraPlan.x - center.x) + outward.y * (cameraPlan.y - center.y)
    const target = side > 0 ? FADED_OPACITY : 1
    material.opacity += (target - material.opacity) * 0.15
    material.depthWrite = material.opacity > 0.9
  })

  return (
    <group position={[mmToM(center.x), mmToM(height) / 2, mmToM(center.y)]} rotation={[0, -angle, 0]}>
      {segments.map((segment) => (
        <mesh
          key={`${segment.x}:${segment.y}:${segment.width}:${segment.height}`}
          position={[mmToM(segment.x), mmToM(segment.y), 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[mmToM(segment.width), mmToM(segment.height), mmToM(wall.thickness)]} />
          <primitive object={material} attach="material" />
        </mesh>
      ))}

      {openings.map((opening) => (
        <OpeningMesh
          key={opening.id}
          opening={opening}
          wall={wall}
          wallLength={length}
          wallHeight={height}
          selected={selectedOpeningId === opening.id}
          invalid={invalidOpeningIds.has(opening.id)}
          onSelect={() => onSelectOpening(opening.id)}
        />
      ))}
    </group>
  )
}

/** Рама проёма, а у окна ещё и стекло. Координаты — в плоскости стены. */
function OpeningMesh({
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
          <meshStandardMaterial
            color="#bcd7e6"
            transparent
            opacity={0.35}
            roughness={0.1}
            metalness={0.1}
          />
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

/** Условная 3D-модель инженерного вывода на его высотной отметке. */
function UtilityMarker({
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

function UtilityGeometry({ utility, color, wallMounted }: { utility: Utility; color: string; wallMounted: boolean }) {
  switch (utility.type) {
    case 'water':
      return (
        <group>
          {[-45, 45].map((offset, index) => (
            <group key={offset} position={[mmToM(offset), 0, 0]}>
              <mesh
                position={wallMounted ? [0, 0, mmToM(70)] : [0, mmToM(90), 0]}
                rotation={wallMounted ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
                castShadow
              >
                <cylinderGeometry args={[mmToM(18), mmToM(18), mmToM(wallMounted ? 140 : 180), 16]} />
                <meshStandardMaterial color={index === 0 ? '#2563eb' : '#dc2626'} roughness={0.45} metalness={0.25} />
              </mesh>
              <mesh position={wallMounted ? [0, 0, mmToM(142)] : [0, mmToM(182), 0]} castShadow>
                <sphereGeometry args={[mmToM(25), 16, 12]} />
                <meshStandardMaterial color={index === 0 ? '#2563eb' : '#dc2626'} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'sewer':
      return (
        <group>
          <mesh
            position={wallMounted ? [0, 0, mmToM(70)] : [0, mmToM(90), 0]}
            rotation={wallMounted ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[mmToM(55), mmToM(55), mmToM(wallMounted ? 140 : 180), 20]} />
            <meshStandardMaterial color={color} roughness={0.72} />
          </mesh>
          <mesh
            position={wallMounted ? [0, 0, mmToM(143)] : [0, mmToM(182), 0]}
            rotation={wallMounted ? [0, 0, 0] : [Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[mmToM(40), mmToM(9), 8, 20]} />
            <meshStandardMaterial color="#312e81" roughness={0.8} />
          </mesh>
        </group>
      )
    case 'gas':
      return (
        <group>
          <mesh
            position={wallMounted ? [0, 0, mmToM(70)] : [0, mmToM(85), 0]}
            rotation={wallMounted ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[mmToM(16), mmToM(16), mmToM(wallMounted ? 140 : 170), 14]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={wallMounted ? [0, mmToM(38), mmToM(145)] : [0, mmToM(130), 0]} castShadow>
            <torusGeometry args={[mmToM(34), mmToM(8), 8, 20]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
          </mesh>
        </group>
      )
    case 'vent':
      return (
        <group rotation={wallMounted ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[mmToM(190), mmToM(190), mmToM(35)]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} roughness={0.65} />
          </mesh>
          {[-55, 0, 55].map((offset) => (
            <mesh key={offset} position={[0, mmToM(offset), mmToM(20)]}>
              <boxGeometry args={[mmToM(145), mmToM(12), mmToM(8)]} />
              <meshStandardMaterial color="#065f46" roughness={0.8} />
            </mesh>
          ))}
        </group>
      )
    case 'power':
      return (
        <group rotation={wallMounted ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[mmToM(150), mmToM(110), mmToM(28)]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} roughness={0.7} />
          </mesh>
          {[-30, 30].map((offset) => (
            <mesh key={offset} position={[mmToM(offset), 0, mmToM(17)]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[mmToM(9), mmToM(9), mmToM(8), 12]} />
              <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
            </mesh>
          ))}
        </group>
      )
  }
}
