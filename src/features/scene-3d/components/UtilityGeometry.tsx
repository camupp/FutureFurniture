import { type Utility } from '@/domain/model'
import { mmToM } from '@/shared/lib/units'

export function UtilityGeometry({
  utility,
  color,
  wallMounted,
}: {
  utility: Utility
  color: string
  wallMounted: boolean
}) {
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
            <boxGeometry args={[mmToM((utility.socketCount ?? 2) === 2 ? 180 : 100), mmToM(110), mmToM(28)]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} roughness={0.7} />
          </mesh>
          {((utility.socketCount ?? 2) === 2 ? [-45, 45] : [0]).flatMap((center) =>
            [-12, 12].map((offset) => (
              <mesh
                key={`${center}:${offset}`}
                position={[mmToM(center + offset), 0, mmToM(17)]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[mmToM(7), mmToM(7), mmToM(8), 12]} />
                <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
              </mesh>
            )),
          )}
        </group>
      )
  }
}
