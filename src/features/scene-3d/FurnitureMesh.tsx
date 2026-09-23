import { useMemo } from 'react'
import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { FurnitureItem } from '@/domain/model'
import { cabinetFrontLayout, type CabinetFrontLayout } from '@/domain/assemblies/cabinetJoints'
import { degToRad, mmToM } from '@/shared/lib/units'
import { Cabinet, Countertop, Hob, Sink, type Cutout } from './blocks'
import { calculateCutouts } from './geometry/cutouts'

type Props = {
  item: FurnitureItem
  others: FurnitureItem[]
  selected: boolean
  invalid: boolean
  warning: boolean
  onSelect: () => void
}

function BlockGeometry({
  item,
  cutouts,
  frontLayout,
}: {
  item: FurnitureItem
  cutouts: Cutout[]
  frontLayout?: CabinetFrontLayout
}) {
  switch (item.type) {
    case 'countertop':
      return (
        <Countertop
          {...item.params}
          cutouts={cutouts}
          polygonOffsetUnits={item.autoCountertop?.groupId ? Math.round(item.rotation / 90) + 1 : undefined}
        />
      )
    case 'sink':
      return <Sink {...item.params} />
    case 'hob':
      return <Hob {...item.params} />
    case 'cabinet':
      return <Cabinet {...item.params} onFloor={item.elevation === 0} cutouts={cutouts} frontLayout={frontLayout} />
  }
}

export function FurnitureMesh({ item, others, selected, invalid, warning, onSelect }: Props) {
  const { width, height, depth } = item.params
  const cutouts = useMemo(() => calculateCutouts(item, others), [item, others])
  const frontLayout = useMemo(
    () => (item.type === 'cabinet' ? cabinetFrontLayout(item, others) : undefined),
    [item, others],
  )

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
      <BlockGeometry item={item} cutouts={cutouts} frontLayout={frontLayout} />
      {(selected || invalid || warning) && (
        <mesh position={[0, mmToM(height) / 2, 0]} raycast={() => null}>
          <boxGeometry args={[mmToM(width), mmToM(height), mmToM(depth)]} />
          <meshBasicMaterial
            transparent
            opacity={invalid || warning ? 0.18 : 0.06}
            color={invalid ? '#dc2626' : warning ? '#d97706' : '#2563eb'}
          />
          <Edges color={invalid ? '#dc2626' : warning ? '#d97706' : '#2563eb'} />
        </mesh>
      )}
    </group>
  )
}
