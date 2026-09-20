import { useState, type ReactNode } from 'react'
import {
  selectedFurniture,
  selectedOpening,
  selectedUtility,
  selectedWall,
  useAppStore,
} from '../../shared/store'
import {
  BLOCK_LABELS,
  BLOCK_LIMITS,
  ELEVATION_LIMITS,
  FACADE_COLORS,
  OPENING_LABELS,
  OPENING_LIMITS,
  UTILITY_COLORS,
  UTILITY_LABELS,
  UTILITY_TYPES,
  WALL_LIMITS,
} from '../../shared/types'
import { pointInPolygon, roomPolygon, wallLength } from '../../shared/utils/geometry'
import { clamp } from '../../shared/utils/units'
import { utilityPoint } from '../../shared/utils/utilities'
import {
  assessUtilities,
  blocksOpening,
  collides,
  connectedUtilityIds,
  isItemInsideRoom,
  openingsOverlap,
} from '../validation/rules'

export function PropertiesPanel() {
  const wall = useAppStore(selectedWall)
  const item = useAppStore(selectedFurniture)
  const opening = useAppStore(selectedOpening)
  const utility = useAppStore(selectedUtility)

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-4">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Свойства</h2>
      {opening ? (
        <OpeningProperties />
      ) : utility ? (
        <UtilityProperties />
      ) : wall ? (
        <WallProperties />
      ) : item ? (
        <BlockProperties />
      ) : (
        <RoomProperties />
      )}
    </aside>
  )
}

function OpeningProperties() {
  const opening = useAppStore(selectedOpening)
  const room = useAppStore((s) => s.room)
  const updateOpening = useAppStore((s) => s.updateOpening)
  const moveOpening = useAppStore((s) => s.moveOpening)
  const removeOpening = useAppStore((s) => s.removeOpening)
  if (!opening) return null

  const wall = room.walls.find((candidate) => candidate.id === opening.wallId)
  const wallSize = wall ? wallLength(wall) : OPENING_LIMITS.width.max
  const maxWidth = Math.min(OPENING_LIMITS.width.max, wallSize)
  const minOffset = opening.width / 2
  const maxOffset = Math.max(minOffset, wallSize - opening.width / 2)
  const overlaps = room.openings.some((other) => openingsOverlap(opening, other, room))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">{OPENING_LABELS[opening.type]}</p>
      {overlaps && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">
          Проём пересекается с другим проёмом
        </p>
      )}

      <NumberField
        label="Ширина"
        value={opening.width}
        min={OPENING_LIMITS.width.min}
        max={maxWidth}
        step={OPENING_LIMITS.width.step}
        onChange={(width) => updateOpening(opening.id, { width })}
      />
      <NumberField
        label="Высота"
        value={opening.height}
        min={OPENING_LIMITS.height.min}
        max={Math.min(OPENING_LIMITS.height.max, room.wallHeight - opening.sill)}
        step={OPENING_LIMITS.height.step}
        onChange={(height) => updateOpening(opening.id, { height })}
      />
      <NumberField
        label="Низ от пола"
        value={opening.sill}
        min={OPENING_LIMITS.sill.min}
        max={opening.type === 'door' ? 0 : Math.min(OPENING_LIMITS.sill.max, room.wallHeight - opening.height)}
        step={OPENING_LIMITS.sill.step}
        onChange={(sill) => updateOpening(opening.id, { sill })}
      />
      <NumberField
        label="Центр от начала стены"
        value={Math.round(opening.offset)}
        min={minOffset}
        max={maxOffset}
        step={10}
        slider={false}
        onChange={(offset) => moveOpening(opening.id, offset)}
      />

      {opening.type === 'door' && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Петли</span>
          <div className="flex gap-1.5">
            {(['left', 'right'] as const).map((hinge) => (
              <button
                key={hinge}
                type="button"
                onClick={() => updateOpening(opening.id, { hinge })}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                  opening.hinge === hinge
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {hinge === 'left' ? 'Слева' : 'Справа'}
              </button>
            ))}
          </div>
        </div>
      )}

      <DangerButton onClick={() => removeOpening(opening.id)}>
        Удалить {OPENING_LABELS[opening.type].toLowerCase()}
      </DangerButton>
    </div>
  )
}

function UtilityProperties() {
  const utility = useAppStore(selectedUtility)
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const updateUtility = useAppStore((s) => s.updateUtility)
  const moveUtility = useAppStore((s) => s.moveUtility)
  const removeUtility = useAppStore((s) => s.removeUtility)
  if (!utility) return null
  const polygon = roomPolygon(room.walls)
  const point = utilityPoint(utility, room)
  const wallMount = utility.mount.kind === 'wall' ? utility.mount : null
  const outside = polygon.length >= 3 && !pointInPolygon(point, polygon)
  const connected = connectedUtilityIds(furniture, room).has(utility.id)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">{UTILITY_LABELS[utility.type]}</p>
      <p className="-mt-3 text-xs text-slate-500">
        {utility.mount.kind === 'wall' ? 'Крепление: стена' : 'Крепление: пол'}
      </p>
      {outside && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Вывод находится за контуром стен</p>
      )}
      {connected ? (
        <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
          Вывод подходит установленной сборке
        </p>
      ) : utility.type !== 'power' && !outside ? (
        <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          Вывод пока не связан с совместимым оборудованием
        </p>
      ) : null}

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Тип</span>
        <div className="flex flex-wrap gap-1">
          {UTILITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateUtility(utility.id, { type })}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                utility.type === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: UTILITY_COLORS[type] }} />
              {UTILITY_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Положение</span>
        {wallMount ? (
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="От угла"
              value={Math.round(wallMount.offset)}
              min={0}
              max={20000}
              step={10}
              slider={false}
              onChange={(offset) => updateUtility(utility.id, { mount: { ...wallMount, offset } })}
            />
            <NumberField
              label="Z"
              value={utility.height}
              min={0}
              max={room.wallHeight}
              step={10}
              slider={false}
              onChange={(height) => updateUtility(utility.id, { height })}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField
              label="X"
              value={Math.round(point.x)}
              min={-50000}
              max={50000}
              step={10}
              slider={false}
              onChange={(x) => moveUtility(utility.id, { ...point, x })}
            />
            <NumberField
              label="Y"
              value={Math.round(point.y)}
              min={-50000}
              max={50000}
              step={10}
              slider={false}
              onChange={(y) => moveUtility(utility.id, { ...point, y })}
            />
          </div>
        )}
      </div>

      <DangerButton onClick={() => removeUtility(utility.id)}>Удалить вывод</DangerButton>
    </div>
  )
}

function RoomProperties() {
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const setWallHeight = useAppStore((s) => s.setWallHeight)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">Ничего не выбрано. Выберите объект на плане.</p>
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
        <dt className="text-slate-500">Проёмов</dt>
        <dd className="text-right text-slate-800">{room.openings.length}</dd>
        <dt className="text-slate-500">Выводов</dt>
        <dd className="text-right text-slate-800">{room.utilities.length}</dd>
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

function BlockProperties() {
  const item = useAppStore(selectedFurniture)
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const updateParams = useAppStore((s) => s.updateFurnitureParams)
  const elevateFurniture = useAppStore((s) => s.elevateFurniture)
  const rotateFurniture = useAppStore((s) => s.rotateFurniture)
  const moveFurniture = useAppStore((s) => s.moveFurniture)
  const removeFurniture = useAppStore((s) => s.removeFurniture)
  if (!item) return null

  const outside = !isItemInsideRoom(item, room)
  const overlapping = collides(item, furniture)
  const coversOpening = blocksOpening(item, room)
  const utilityAssessment = assessUtilities(item, furniture, room)
  const utilityWarnings = [...new Set(utilityAssessment.warnings)]

  const limits = BLOCK_LIMITS[item.type]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">{BLOCK_LABELS[item.type]}</p>
      {outside && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок выходит за контур стен</p>
      )}
      {overlapping && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок пересекается с другим блоком</p>
      )}
      {coversOpening && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок перекрывает проём</p>
      )}
      {utilityWarnings.map((warning) => (
        <p key={warning} className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
          {warning}
        </p>
      ))}
      {utilityAssessment.connected.length > 0 && (
        <p className="rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700">
          Подключения совместимы:{' '}
          {[...new Set(utilityAssessment.connected.map((utility) => UTILITY_LABELS[utility.type]))].join(', ')}
        </p>
      )}

      <NumberField
        label={item.type === 'countertop' ? 'Длина' : 'Ширина'}
        value={item.params.width}
        {...limits.width}
        onChange={(width) => updateParams(item.id, { width })}
      />
      <NumberField
        label={item.type === 'countertop' ? 'Толщина' : 'Высота'}
        value={item.params.height}
        {...limits.height}
        onChange={(height) => updateParams(item.id, { height })}
      />
      <NumberField
        label="Глубина"
        value={item.params.depth}
        {...limits.depth}
        onChange={(depth) => updateParams(item.id, { depth })}
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Цвет</span>
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

      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Положение <span className="text-slate-400">X и Y — на плане, Z — над полом</span>
        </span>
        <div className="grid grid-cols-3 gap-1.5">
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
          <NumberField
            label="Z"
            value={item.elevation}
            min={ELEVATION_LIMITS.min}
            max={Math.max(0, room.wallHeight - item.params.height)}
            step={ELEVATION_LIMITS.step}
            slider={false}
            onChange={(elevation) => elevateFurniture(item.id, elevation)}
          />
        </div>
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
