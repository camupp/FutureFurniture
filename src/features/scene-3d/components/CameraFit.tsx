import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { degToRad } from '@/shared/lib/units'

type CameraFitProps = { target: [number, number, number]; radius: number; fitKey: number }

export function CameraFit({ target, radius, fitKey }: CameraFitProps) {
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
    camera.position.set(target[0] + distance * 0.6, target[1] + distance * 0.55, target[2] + distance * 0.6)
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
