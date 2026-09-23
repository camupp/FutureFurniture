import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { type Opening, type Point, type Wall } from '@/domain/model'
import { wallAngle, wallCenter, wallLength } from '@/domain/geometry/geometry'
import { clampOffset } from '@/domain/room/openings'
import { mmToM } from '@/shared/lib/units'
import { panelSegments } from '../blocks/slab'
import { OpeningMesh } from './OpeningMesh'

const FADED_OPACITY = 0.1

type WallMeshProps = {
  wall: Wall
  height: number
  roomCenter: Point
  openings: Opening[]
  selectedOpeningId?: string
  invalidOpeningIds: Set<string>
  onSelectOpening: (id: string) => void
}

export function WallMesh({
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
   * Стена разбивается на прямоугольные секции вокруг проёмов.
   * Координаты секций лежат в плоскости «длина × высота», ноль — в центре стены.
   * Такой способ устойчив и для дверей до пола, и для пересекающихся проёмов.
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
