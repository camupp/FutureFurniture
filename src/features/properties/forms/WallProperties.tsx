import { selectedWall, useAppStore } from '@/application/project'
import { WALL_LIMITS } from '@/domain/model'
import { wallLength } from '@/domain/geometry/geometry'
import { HistoryNumberField as NumberField } from '../HistoryNumberField'
import { DangerButton } from '@/shared/ui/DangerButton'

export function WallProperties() {
  const wall = useAppStore(selectedWall)
  const updateWallLength = useAppStore((s) => s.updateWallLength)
  const updateWallThickness = useAppStore((s) => s.updateWallThickness)
  const removeWall = useAppStore((s) => s.removeWall)
  if (!wall) return null

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">Стена</p>
      <NumberField
        label="Длина"
        value={Math.round(wallLength(wall))}
        min={100}
        max={20000}
        step={10}
        onChange={(value) => updateWallLength(wall.id, value)}
      />
      <NumberField
        label="Толщина"
        value={wall.thickness}
        min={WALL_LIMITS.thickness.min}
        max={WALL_LIMITS.thickness.max}
        step={WALL_LIMITS.thickness.step}
        onChange={(value) => updateWallThickness(wall.id, value)}
      />
      <DangerButton onClick={() => removeWall(wall.id)}>Удалить стену</DangerButton>
    </div>
  )
}
