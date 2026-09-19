import { useState, type ReactNode } from 'react'
import { selectedFurniture, selectedWall, useAppStore } from '../../shared/store'
import { CABINET_LIMITS, ELEVATION_LIMITS, FACADE_COLORS, WALL_LIMITS } from '../../shared/types'
import { wallLength } from '../../shared/utils/geometry'
import { clamp } from '../../shared/utils/units'
import { isItemInsideRoom } from '../validation/rules'

export function PropertiesPanel() {
  const wall = useAppStore(selectedWall)
  const item = useAppStore(selectedFurniture)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Свойства</h2>
      {wall ? <WallProperties /> : item ? <CabinetProperties /> : <RoomProperties />}
    </aside>
  )
}

function RoomProperties() {
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const setWallHeight = useAppStore((s) => s.setWallHeight)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">Ничего не выбрано. Выберите стену или блок на плане.</p>
      <NumberField
        label="Высота стен"
        value={room.wallHeight}
        min={WALL_LIMITS.height.min}
        max={WALL_LIMITS.height.max}
        step={WALL_LIMITS.height.step}
        onChange={setWallHeight}
      />
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-slate-500">Стен</dt>
        <dd className="text-right text-slate-800">{room.walls.length}</dd>
        <dt className="text-slate-500">Блоков</dt>
        <dd className="text-right text-slate-800">{furniture.length}</dd>
      </dl>
    </div>
  )
}

function WallProperties() {
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

function CabinetProperties() {
  const item = useAppStore(selectedFurniture)
  const room = useAppStore((s) => s.room)
  const updateParams = useAppStore((s) => s.updateFurnitureParams)
  const elevateFurniture = useAppStore((s) => s.elevateFurniture)
  const rotateFurniture = useAppStore((s) => s.rotateFurniture)
  const moveFurniture = useAppStore((s) => s.moveFurniture)
  const removeFurniture = useAppStore((s) => s.removeFurniture)
  if (!item) return null

  const outside = !isItemInsideRoom(item, room)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">Шкаф напольный</p>
      {outside && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок выходит за контур стен</p>
      )}

      <NumberField
        label="Ширина"
        value={item.params.width}
        {...CABINET_LIMITS.width}
        onChange={(width) => updateParams(item.id, { width })}
      />
      <NumberField
        label="Высота"
        value={item.params.height}
        {...CABINET_LIMITS.height}
        onChange={(height) => updateParams(item.id, { height })}
      />
      <NumberField
        label="Глубина"
        value={item.params.depth}
        {...CABINET_LIMITS.depth}
        onChange={(depth) => updateParams(item.id, { depth })}
      />
      <NumberField
        label="Высота от пола"
        value={item.elevation}
        min={ELEVATION_LIMITS.min}
        max={Math.max(0, room.wallHeight - item.params.height)}
        step={ELEVATION_LIMITS.step}
        onChange={(elevation) => elevateFurniture(item.id, elevation)}
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Фасад</span>
        <div className="flex gap-2">
          {FACADE_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.label}
              onClick={() => updateParams(item.id, { facadeColor: color.value })}
              className={`h-8 w-8 rounded-full border-2 ${
                item.params.facadeColor === color.value ? 'border-blue-500' : 'border-slate-200'
              }`}
              style={{ backgroundColor: color.value }}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Поворот</span>
        <div className="flex gap-1.5">
          {[0, 90, 180, 270].map((angle) => (
            <button
              key={angle}
              type="button"
              onClick={() => rotateFurniture(item.id, angle)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                item.rotation === angle
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {angle}°
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={Math.round(item.position.x)}
          min={-50000}
          max={50000}
          step={10}
          slider={false}
          onChange={(x) => moveFurniture(item.id, { ...item.position, x })}
        />
        <NumberField
          label="Y"
          value={Math.round(item.position.y)}
          min={-50000}
          max={50000}
          step={10}
          slider={false}
          onChange={(y) => moveFurniture(item.id, { ...item.position, y })}
        />
      </div>

      <DangerButton onClick={() => removeFurniture(item.id)}>Удалить блок</DangerButton>
    </div>
  )
}

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  slider?: boolean
  onChange: (value: number) => void
}

function NumberField({ label, value, min, max, step, slider = true, onChange }: NumberFieldProps) {
  // Пока поле редактируют, значение живёт в draft: иначе промежуточный ввод
  // («», «1» вместо «1200») сразу уезжал бы в модель и зажимался по границам.
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string) => {
    const parsed = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed, min, max))
    setDraft(null)
  }

  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-xs font-medium text-slate-600">
        {label}
        <span className="text-slate-400">мм</span>
      </span>
      <input
        type="number"
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setDraft(null)
        }}
        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
      />
      {slider && (
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            setDraft(null)
            onChange(Number(e.target.value))
          }}
          className="mt-1.5 w-full accent-blue-600"
        />
      )}
    </label>
  )
}

function DangerButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
    >
      {children}
    </button>
  )
}
