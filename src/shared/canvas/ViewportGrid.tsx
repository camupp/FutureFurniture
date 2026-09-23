import { useMemo, type ReactNode } from 'react'
import { Line } from 'react-konva'
import type { StageView } from './useStageViewport'

export function ViewportGrid({ view, width, height }: { view: StageView; width: number; height: number }) {
  return useMemo<ReactNode>(() => {
    if (!width || !height) return null
    const left = -view.x / view.scale
    const top = -view.y / view.scale
    const right = left + width / view.scale
    const bottom = top + height / view.scale
    const step = (right - left) / 100 > 100 || view.scale * 100 < 6 ? 1000 : 100
    const lines: ReactNode[] = []

    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      const major = Math.abs(x % 1000) < 0.001
      lines.push(
        <Line
          key={`v${x}`}
          points={[x, top, x, bottom]}
          stroke={major ? '#cbd5e1' : '#e8eef6'}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />,
      )
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      const major = Math.abs(y % 1000) < 0.001
      lines.push(
        <Line
          key={`h${y}`}
          points={[left, y, right, y]}
          stroke={major ? '#cbd5e1' : '#e8eef6'}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />,
      )
    }
    return lines
  }, [view, width, height])
}
