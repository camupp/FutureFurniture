import { Edges } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { FurnitureItem } from '../../shared/types'
import { degToRad, mmToM } from '../../shared/utils/units'
import { Cabinet } from '../parametric-blocks'

type Props = {
  item: FurnitureItem
  selected: boolean
  invalid: boolean
  onSelect: () => void
}

export function FurnitureMesh({ item, selected, invalid, onSelect }: Props) {
  const { width, height, depth } = item.params

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
      <Cabinet {...item.params} onFloor={item.elevation === 0} />
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
