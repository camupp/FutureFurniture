import { useCallback, useState } from 'react'
import type Konva from 'konva'
import type { Point } from '../types'
import { bounds } from './geometry'
import { clamp } from './units'

const MIN_SCALE = 0.005
const MAX_SCALE = 1

export type StageView = { scale: number; x: number; y: number }

/** Общая логика зума/панорамы для 2D-холстов: план и вид по высоте. */
export function useStageViewport(width: number, height: number) {
  const [view, setView] = useState<StageView>({ scale: 0.08, x: 80, y: 80 })

  const fitTo = useCallback(
    (points: Point[], padding = 600) => {
      if (!width || !height || points.length === 0) return
      const box = bounds(points)
      const scale = clamp(
        Math.min(width / (box.width + padding * 2), height / (box.height + padding * 2)),
        MIN_SCALE,
        MAX_SCALE,
      )
      setView({ scale, x: width / 2 - box.center.x * scale, y: height / 2 - box.center.y * scale })
    },
    [width, height],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      setView((v) => {
        const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE)
        const center = { x: (width / 2 - v.x) / v.scale, y: (height / 2 - v.y) / v.scale }
        return { scale, x: width / 2 - center.x * scale, y: height / 2 - center.y * scale }
      })
    },
    [width, height],
  )

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const pointer = stage?.getPointerPosition()
    if (!pointer) return
    setView((v) => {
      const scale = clamp(v.scale * (e.evt.deltaY > 0 ? 0.92 : 1.08), MIN_SCALE, MAX_SCALE)
      const mouse = { x: (pointer.x - v.x) / v.scale, y: (pointer.y - v.y) / v.scale }
      return { scale, x: pointer.x - mouse.x * scale, y: pointer.y - mouse.y * scale }
    })
  }, [])

  const handleStageDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    // dragEnd всплывает и от блоков — смещение вида берём только у самого Stage.
    if (e.target !== e.target.getStage()) return
    setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
  }, [])

  return { view, fitTo, zoomBy, handleWheel, handleStageDragEnd }
}

/** Координаты указателя в миллиметрах сцены. */
export function stagePointer(stage: Konva.Stage | null): Point | null {
  if (!stage) return null
  const pointer = stage.getPointerPosition()
  if (!pointer) return null
  return { x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() }
}
