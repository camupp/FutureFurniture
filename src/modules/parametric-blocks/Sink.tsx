import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { BUILT_IN_FLANGE, type BlockParams } from '../../shared/types'
import { mmToM } from '../../shared/utils/units'

const RIM = BUILT_IN_FLANGE.sink
/** Насколько чаша уже габарита: на эту кромку опирается бортик. */
const BOWL_INSET = 80
const WALL = 20

/**
 * Врезная мойка: чаша с открытым верхом и бортик-рамка по контуру.
 * Локальный ноль — центр по ширине, дно чаши на y = 0, бортик на уровне `height`.
 * Бортик именно рамка: сплошная плита закрыла бы чашу сверху.
 */
export function Sink({ width, height, depth, facadeColor }: BlockParams) {
  const w = mmToM(width)
  const h = mmToM(height)
  const d = mmToM(depth)
  const rim = mmToM(RIM)
  const wall = mmToM(WALL)

  const bowlW = w - mmToM(BOWL_INSET)
  const bowlD = d - mmToM(BOWL_INSET)
  const bowlH = h - rim
  const openW = bowlW - wall * 2
  const openD = bowlD - wall * 2

  const rimGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-w / 2, -d / 2)
    shape.lineTo(w / 2, -d / 2)
    shape.lineTo(w / 2, d / 2)
    shape.lineTo(-w / 2, d / 2)
    shape.closePath()
    const hole = new THREE.Path()
    hole.moveTo(-openW / 2, -openD / 2)
    hole.lineTo(openW / 2, -openD / 2)
    hole.lineTo(openW / 2, openD / 2)
    hole.lineTo(-openW / 2, openD / 2)
    hole.closePath()
    shape.holes.push(hole)
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: rim, bevelEnabled: false })
    geometry.rotateX(Math.PI / 2)
    geometry.translate(0, h, 0)
    return geometry
  }, [w, d, h, rim, openW, openD])

  useEffect(() => () => rimGeometry.dispose(), [rimGeometry])

  /**
   * Внутренности чаши матовее и темнее бортика: у горизонтального дна с высокой
   * металличностью блик выбивает цвет в белый, и чаша перестаёт читаться как единая.
   */
  const bowlColor = useMemo(() => new THREE.Color(facadeColor).multiplyScalar(0.45), [facadeColor])
  const material = <meshStandardMaterial color={bowlColor} roughness={0.6} metalness={0.2} />

  return (
    <group>
      <mesh position={[0, wall / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[bowlW, wall, bowlD]} />
        {material}
      </mesh>
      <mesh position={[0, bowlH / 2, -bowlD / 2 + wall / 2]} castShadow receiveShadow>
        <boxGeometry args={[bowlW, bowlH, wall]} />
        {material}
      </mesh>
      <mesh position={[0, bowlH / 2, bowlD / 2 - wall / 2]} castShadow receiveShadow>
        <boxGeometry args={[bowlW, bowlH, wall]} />
        {material}
      </mesh>
      <mesh position={[-bowlW / 2 + wall / 2, bowlH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wall, bowlH, openD]} />
        {material}
      </mesh>
      <mesh position={[bowlW / 2 - wall / 2, bowlH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[wall, bowlH, openD]} />
        {material}
      </mesh>

      <mesh geometry={rimGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={facadeColor} roughness={0.22} metalness={0.85} />
      </mesh>

      <mesh position={[0, h + mmToM(100), -d / 2 + mmToM(70)]} castShadow>
        <cylinderGeometry args={[mmToM(16), mmToM(16), mmToM(220), 10]} />
        <meshStandardMaterial color="#c3c8ce" roughness={0.2} metalness={0.9} />
      </mesh>
    </group>
  )
}
