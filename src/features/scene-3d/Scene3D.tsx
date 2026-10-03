import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useAppStore } from '@/application/project'
import { roomPolygon } from '@/domain/geometry/geometry'
import { bounds } from '@/shared/lib/geometry2d'
import { mmToM } from '@/shared/lib/units'
import {
  connectedUtilityIds,
  invalidItemIds,
  invalidOpeningIds,
  invalidUtilityIds,
  warningItemIds,
} from '@/domain/validation/rules'
import { FurnitureMesh } from './FurnitureMesh'
import { RoomMesh } from './RoomMesh'
import { sceneCanvas } from './screenshot'
import { CameraFit } from './components/CameraFit'
import type { FurnitureItem } from '@/domain/model'

export function Scene3D({ previewFurniture = [] }: { previewFurniture?: FurnitureItem[] }) {
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const [fitKey, setFitKey] = useState(0)

  const invalid = useMemo(() => invalidItemIds(furniture, room), [furniture, room])
  const warnings = useMemo(() => warningItemIds(furniture, room), [furniture, room])
  const connectedUtilities = useMemo(() => connectedUtilityIds(furniture, room), [furniture, room])
  const invalidOpenings = useMemo(() => invalidOpeningIds(room), [room])
  const invalidUtilities = useMemo(() => invalidUtilityIds(room), [room])
  const selectedCountertopGroup =
    selection?.kind === 'furniture'
      ? furniture.find((item) => item.id === selection.id)?.autoCountertop?.groupId
      : undefined
  const box = useMemo(() => bounds(roomPolygon(room.walls)), [room.walls])
  const target: [number, number, number] = [mmToM(box.center.x), mmToM(room.wallHeight) / 2, mmToM(box.center.y)]
  /** Радиус описанной сферы помещения — по нему считается отлёт камеры. */
  const radius =
    Math.max(Math.hypot(mmToM(box.width), mmToM(box.height), mmToM(room.wallHeight)), mmToM(room.wallHeight)) / 2

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

        <RoomMesh
          room={room}
          selectedOpeningId={selection?.kind === 'opening' ? selection.id : undefined}
          selectedUtilityId={selection?.kind === 'utility' ? selection.id : undefined}
          invalidOpeningIds={invalidOpenings}
          invalidUtilityIds={invalidUtilities}
          connectedUtilityIds={connectedUtilities}
          onSelectOpening={(id) => select({ kind: 'opening', id })}
          onSelectUtility={(id) => select({ kind: 'utility', id })}
        />
        {furniture.map((item) => (
          <FurnitureMesh
            key={item.id}
            item={item}
            others={furniture}
            selected={
              selection?.kind === 'furniture' &&
              (selection.id === item.id ||
                Boolean(selectedCountertopGroup && item.autoCountertop?.groupId === selectedCountertopGroup))
            }
            invalid={invalid.has(item.id)}
            warning={warnings.has(item.id)}
            onSelect={() => select({ kind: 'furniture', id: item.id })}
          />
        ))}
        {previewFurniture.map((item) => (
          <FurnitureMesh
            key={item.id}
            item={item}
            others={[...furniture, ...previewFurniture]}
            selected={false}
            invalid={false}
            warning={false}
            preview
            onSelect={() => undefined}
          />
        ))}

        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2 - 0.05} minDistance={1} maxDistance={40} />
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
