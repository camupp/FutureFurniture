import { selectedFurniture, useAppStore } from '@/application/project'
import { BLOCK_LABELS, BLOCK_LIMITS, ELEVATION_LIMITS, FACADE_COLORS, UTILITY_LABELS } from '@/domain/model'
import { isCountertopSupport } from '@/domain/assemblies/countertops'
import { wallAnchorIsValid, wallAnchorOffsetLimits } from '@/domain/placement/wallAnchors'
import { assessUtilities, blocksOpening, collides, isItemInsideRoom } from '@/domain/validation/rules'
import { NumberField } from '@/shared/ui/NumberField'
import { DangerButton } from '@/shared/ui/DangerButton'

export function BlockProperties() {
  const item = useAppStore(selectedFurniture)
  const room = useAppStore((s) => s.room)
  const furniture = useAppStore((s) => s.furniture)
  const updateParams = useAppStore((s) => s.updateFurnitureParams)
  const elevateFurniture = useAppStore((s) => s.elevateFurniture)
  const rotateFurniture = useAppStore((s) => s.rotateFurniture)
  const moveFurniture = useAppStore((s) => s.moveFurniture)
  const moveFurnitureAlongWall = useAppStore((s) => s.moveFurnitureAlongWall)
  const detachFurniture = useAppStore((s) => s.detachFurniture)
  const addCountertopForRow = useAppStore((s) => s.addCountertopForRow)
  const detachCountertop = useAppStore((s) => s.detachCountertop)
  const removeFurniture = useAppStore((s) => s.removeFurniture)
  if (!item) return null

  const outside = !isItemInsideRoom(item, room)
  const invalidAnchor = !wallAnchorIsValid(item, room)
  const overlapping = collides(item, furniture)
  const coversOpening = blocksOpening(item, room)
  const utilityAssessment = assessUtilities(item, furniture, room)
  const utilityWarnings = [...new Set(utilityAssessment.warnings)]

  const limits = BLOCK_LIMITS[item.type]
  const anchorWall = item.wallAnchor
    ? room.walls.find((candidate) => candidate.id === item.wallAnchor?.wallId)
    : undefined
  const anchorWallIndex = anchorWall ? room.walls.findIndex((candidate) => candidate.id === anchorWall.id) : -1
  const anchorLimits =
    item.wallAnchor && anchorWall
      ? wallAnchorOffsetLimits(item, anchorWall, room.walls, item.wallAnchor.side, item.wallAnchor.distance)
      : undefined
  const automatic = Boolean(item.autoCountertop)
  const canAddCountertop = isCountertopSupport(item)
  const hasCountertop = furniture.some((candidate) => candidate.autoCountertop?.supportIds.includes(item.id))
  const automaticSupports = item.autoCountertop
    ? new Set(
        furniture
          .filter(
            (candidate) =>
              candidate.autoCountertop &&
              (item.autoCountertop?.groupId
                ? candidate.autoCountertop.groupId === item.autoCountertop.groupId
                : candidate.id === item.id),
          )
          .flatMap((candidate) => candidate.autoCountertop!.supportIds),
      ).size
    : 0

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium text-slate-800">{BLOCK_LABELS[item.type]}</p>
      {item.wallAnchor && anchorWall && (
        <div className="-mt-2 flex items-center justify-between gap-2 rounded-md bg-emerald-50 px-2.5 py-2 text-xs text-emerald-800">
          <span>Прикреплён к стене {anchorWallIndex + 1}</span>
          <button
            type="button"
            disabled={automatic}
            onClick={() => detachFurniture(item.id)}
            className="font-medium underline decoration-emerald-300 underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отвязать
          </button>
        </div>
      )}
      {canAddCountertop && (
        <button
          type="button"
          onClick={() => addCountertopForRow(item.id)}
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
        >
          {hasCountertop ? 'Выбрать столешницу' : 'Столешница на ряд'}
        </button>
      )}
      {item.autoCountertop && (
        <div className="rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-800">
          <p className="font-medium">
            {item.autoCountertop.groupId ? 'Автоподгон угловой столешницы' : 'Автоподгон по ряду'}
          </p>
          <p className="mt-1">
            Тумб: {automaticSupports}. Размеры и положение рассчитываются по расстановке. Передний свес —{' '}
            {item.autoCountertop.frontOverhang} мм.
          </p>
          <button
            type="button"
            onClick={() => detachCountertop(item.id)}
            className="mt-2 font-medium underline decoration-blue-300 underline-offset-2"
          >
            Редактировать вручную
          </button>
        </div>
      )}
      {outside && <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок выходит за контур стен</p>}
      {invalidAnchor && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">
          Блок не помещается по длине привязанной стены
        </p>
      )}
      {overlapping && (
        <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок пересекается с другим блоком</p>
      )}
      {coversOpening && <p className="rounded-md bg-red-50 px-2.5 py-2 text-xs text-red-700">Блок перекрывает проём</p>}
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
        disabled={automatic}
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
        disabled={automatic}
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
              disabled={automatic}
              onClick={() => rotateFurniture(item.id, angle)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
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
          Положение{' '}
          <span className="text-slate-400">
            {item.wallAnchor && anchorWall ? 'вдоль стены и над полом' : 'X и Y — на плане, Z — над полом'}
          </span>
        </span>
        <div className={`grid gap-1.5 ${item.wallAnchor && anchorWall ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {item.wallAnchor && anchorWall ? (
            <NumberField
              label="От начала"
              disabled={automatic}
              value={Math.round(item.wallAnchor.offset)}
              min={anchorLimits?.min ?? item.params.width / 2}
              max={anchorLimits?.max ?? item.params.width / 2}
              step={10}
              slider={false}
              onChange={(offset) => moveFurnitureAlongWall(item.id, offset)}
            />
          ) : (
            <>
              <NumberField
                label="X"
                disabled={automatic}
                value={Math.round(item.position.x)}
                min={-50000}
                max={50000}
                step={10}
                slider={false}
                onChange={(x) => moveFurniture(item.id, { ...item.position, x })}
              />
              <NumberField
                label="Y"
                disabled={automatic}
                value={Math.round(item.position.y)}
                min={-50000}
                max={50000}
                step={10}
                slider={false}
                onChange={(y) => moveFurniture(item.id, { ...item.position, y })}
              />
            </>
          )}
          <NumberField
            label="Z"
            disabled={automatic}
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
