import { useEffect, useMemo } from 'react'
import { buildSlab, type Cutout } from './slab'
import type { BlockParams } from '@/domain/model'

/**
 * Столешница. Локальный ноль — центр по ширине, низ плиты на y = 0.
 * `height` означает толщину плиты. Вырезы под мойку и плиту вычитаются
 * из полотна — без них врезная техника пересекала бы столешницу.
 */
export function Countertop({
  width,
  height,
  depth,
  facadeColor,
  cutouts = [],
  polygonOffsetUnits,
}: BlockParams & { cutouts?: Cutout[]; polygonOffsetUnits?: number }) {
  const geometry = useMemo(() => buildSlab(width, depth, height, cutouts), [width, height, depth, cutouts])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={facadeColor}
        roughness={0.4}
        metalness={0.05}
        polygonOffset={polygonOffsetUnits !== undefined}
        polygonOffsetFactor={polygonOffsetUnits === undefined ? 0 : 1}
        polygonOffsetUnits={polygonOffsetUnits ?? 0}
      />
    </mesh>
  )
}
