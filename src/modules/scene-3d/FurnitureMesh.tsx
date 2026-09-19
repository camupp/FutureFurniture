import { useMemo } from 'react'
import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { FurnitureItem } from '../../shared/types'
import { isBuiltIn } from '../../shared/utils/collision'
import { bounds, itemFootprint, rotatePoint } from '../../shared/utils/geometry'
import { degToRad, mmToM } from '../../shared/utils/units'
import { Cabinet, Countertop, Hob, Sink, type Cutout } from '../parametric-blocks'

/** Насколько вырез уже самого блока — на эту кромку опирается бортик мойки или панели. */
const CUTOUT_MARGIN = 35

type Props = {
  item: FurnitureItem
  others: FurnitureItem[]
  selected: boolean
  invalid: boolean
  onSelect: () => void
}

/**
 * Вырезы в столешнице под врезную технику, стоящую над ней.
 * Считаются в локальной системе столешницы: x — вдоль ширины, z — вдоль глубины.
 */
function useCutouts(item: FurnitureItem, others: FurnitureItem[]): Cutout[] {
  return useMemo(() => {
    if (item.type !== 'countertop' && item.type !== 'cabinet') return []
    const halfWidth = item.params.width / 2
    const halfDepth = item.params.depth / 2

    return others.flatMap((other) => {
      if (!isBuiltIn(other)) return []
      const localCorners = itemFootprint(other).map((corner) =>
        rotatePoint(corner, item.position, -item.rotation),
      )
      const box = bounds(localCorners)
      const x = box.center.x - item.position.x
      const z = box.center.y - item.position.y
      const width = box.width - CUTOUT_MARGIN * 2
      const depth = box.height - CUTOUT_MARGIN * 2
      if (width <= 0 || depth <= 0) return []
      // Вырез имеет смысл только если техника действительно лежит на этой плите.
      if (Math.abs(x) + width / 2 > halfWidth || Math.abs(z) + depth / 2 > halfDepth) return []
      return [{ x, z, width, depth }]
    })
  }, [item, others])
}

function BlockGeometry({ item, cutouts }: { item: FurnitureItem; cutouts: Cutout[] }) {
  switch (item.type) {
    case 'countertop':
      return <Countertop {...item.params} cutouts={cutouts} />
    case 'sink':
      return <Sink {...item.params} />
    case 'hob':
      return <Hob {...item.params} />
    case 'cabinet':
      return <Cabinet {...item.params} onFloor={item.elevation === 0} cutouts={cutouts} />
  }
}

export function FurnitureMesh({ item, others, selected, invalid, onSelect }: Props) {
  const { width, height, depth } = item.params
  const cutouts = useCutouts(item, others)

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onSelect()
  }

  return (
    <group
      position={[mmToM(item.position.x), mmToM(item.elevation), mmToM(item.position.y)]}
      rotation={[0, -degToRad(item.rotation), 0]}
      onClick={handleClick}
    >
      <BlockGeometry item={item} cutouts={cutouts} />
      {(selected || invalid) && (
        <mesh position={[0, mmToM(height) / 2, 0]} raycast={() => null}>
          <boxGeometry args={[mmToM(width), mmToM(height), mmToM(depth)]} />
          <meshBasicMaterial transparent opacity={invalid ? 0.18 : 0.06} color={invalid ? '#dc2626' : '#2563eb'} />
          <Edges color={invalid ? '#dc2626' : '#2563eb'} />
        </mesh>
      )}
    </group>
  )
}
