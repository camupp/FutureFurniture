import { useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type * as THREE from 'three'
import { useAppStore } from '../../shared/store'
import { bounds, roomPolygon } from '../../shared/utils/geometry'
import { degToRad, mmToM } from '../../shared/utils/units'
import { invalidItemIds } from '../validation/rules'
import { FurnitureMesh } from './FurnitureMesh'
import { RoomMesh } from './RoomMesh'
import { sceneCanvas } from './screenshot'

export function Scene3D() {
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const [fitKey, setFitKey] = useState(0)

  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const box = useMemo(() => bounds(roomPolygon(room.walls)), [room.walls])
  const target: [number, number, number] = [mmToM(box.center.x), mmToM(room.wallHeight) / 2, mmToM(box.center.y)]
  /** Радиус описанной сферы помещения — по нему считается отлёт камеры. */
  const radius =
    Math.max(
      Math.hypot(mmToM(box.width), mmToM(box.height), mmToM(room.wallHeight)),
      mmToM(room.wallHeight),
    ) / 2

  return (
    <div className="relative min-w-0 flex-1 bg-slate-200">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 45, near: 0.1, far: 200 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          sceneCanvas.current = gl.domElement
        }}
        onPointerMissed={() => select(null)}
      >
        <color attach="background" args={['#e9edf2']} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#ffffff', '#b8b1a6', 0.6]} />
        <directionalLight
          position={[6, 9, 4]}
          intensity={1.7}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
          // Без смещения тонкие плиты покрываются полосами самозатенения (shadow acne).
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />

        <RoomMesh room={room} />
        {furniture.map((item) => (
          <FurnitureMesh
            key={item.id}
            item={item}
            others={furniture}
            selected={selection?.kind === 'furniture' && selection.id === item.id}
            invalid={invalid.has(item.id)}
            onSelect={() => select({ kind: 'furniture', id: item.id })}
          />
        ))}

        <OrbitControls
          makeDefault
          enableDamping
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={1}
          maxDistance={40}
        />
        <CameraFit target={target} radius={radius} fitKey={fitKey} />
      </Canvas>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3">
        <span className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm">
          3D · перетаскивание — поворот, колесо — зум
        </span>
        <button
          type="button"
          onClick={() => setFitKey((key) => key + 1)}
          className="pointer-events-auto rounded-md bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-white"
        >
          Сбросить камеру
        </button>
      </div>
    </div>
  )
}

type CameraFitProps = { target: [number, number, number]; radius: number; fitKey: number }

function CameraFit({ target, radius, fitKey }: CameraFitProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null

  // На первом кадре канвас может быть нулевого размера — фитить камеру по нему нельзя.
  const hasSize = size.width > 0 && size.height > 0
  /**
   * Пропорции канваса, огрублённые до четвертей. Мелкое изменение размера окна камеру
   * не трогает, а смена раскладки (2D+3D → 3D) переобучает её: иначе кадр, рассчитанный
   * на узкую панель, оставляет комнату за пределами экрана.
   */
  const aspectBucket = hasSize ? Math.round((size.width / size.height) * 4) : 0

  useEffect(() => {
    if (!hasSize) return
    const aspect = size.width / size.height
    const fov = degToRad(camera.fov)
    const distance = Math.max((radius / Math.sin(fov / 2) / Math.min(1, aspect)) * 1.1, 3)
    camera.position.set(
      target[0] + distance * 0.6,
      target[1] + distance * 0.55,
      target[2] + distance * 0.6,
    )
    if (controls) {
      controls.target.set(target[0], target[1], target[2])
      controls.update()
    } else {
      camera.lookAt(target[0], target[1], target[2])
    }
    // Камера выставляется при монтировании, по кнопке «Сбросить камеру» и при смене раскладки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, controls, hasSize, aspectBucket])

  return null
}
