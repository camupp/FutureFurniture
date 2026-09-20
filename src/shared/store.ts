import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  BLOCK_LIMITS,
  OPENING_DEFAULTS,
  OPENING_LIMITS,
  projectSchema,
  UTILITY_DEFAULT_HEIGHT,
  WALL_LIMITS,
  type BlockParams,
  type BlockType,
  type FurnitureItem,
  type Opening,
  type OpeningType,
  type Point,
  type Project,
  type Room,
  type Utility,
  type UtilityMount,
  type UtilityType,
  type Wall,
} from './types'
import { snapElevation } from './utils/elevation'
import { bounds, roomPolygon, setWallLength, wallLength } from './utils/geometry'
import { normalizeOpening } from './utils/openings'
import { placeBlock, placeBlockInSection } from './utils/snapping'
import { clamp } from './utils/units'
import { moveUtilityToPoint, normalizeUtility, utilityPoint } from './utils/utilities'

export type Tool = 'select' | 'wall' | 'window' | 'door' | 'utility' | 'pan'
export type ViewMode = '2d' | 'split' | '3d'
/** Что показывает 2D-холст: план сверху или вид по высоте. */
export type EditorView = 'plan' | 'elevation'
export type SelectionKind = 'wall' | 'furniture' | 'opening' | 'utility'
export type Selection = { kind: SelectionKind; id: string } | null

const DEFAULT_WALL_THICKNESS = 100
const DEFAULT_WALL_HEIGHT = 2700

const newId = () => crypto.randomUUID()

function createDefaultRoom(): Room {
  const width = 3600
  const depth = 3000
  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ]
  const walls: Wall[] = corners.map((corner, i) => ({
    id: newId(),
    start: corner,
    end: corners[(i + 1) % corners.length],
    thickness: DEFAULT_WALL_THICKNESS,
  }))
  return { walls, wallHeight: DEFAULT_WALL_HEIGHT, openings: [], utilities: [] }
}

function clampParams(type: BlockType, params: BlockParams): BlockParams {
  const limits = BLOCK_LIMITS[type]
  return {
    ...params,
    width: clamp(params.width, limits.width.min, limits.width.max),
    height: clamp(params.height, limits.height.min, limits.height.max),
    depth: clamp(params.depth, limits.depth.min, limits.depth.max),
  }
}

/** Данные пресета каталога, которых достаточно, чтобы создать блок. */
export type NewBlock = { type: BlockType; elevation: number; params: BlockParams }

type AppState = Project & {
  selection: Selection
  tool: Tool
  orthoSnap: boolean
  smartPlacement: boolean
  viewMode: ViewMode
  editorView: EditorView
  /** Какой вывод ставит инструмент «Коммуникация». */
  utilityType: UtilityType

  setTool: (tool: Tool) => void
  setUtilityType: (type: UtilityType) => void
  setOrthoSnap: (enabled: boolean) => void
  setSmartPlacement: (enabled: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setEditorView: (view: EditorView) => void
  select: (selection: Selection) => void

  addWall: (start: Point, end: Point) => void
  updateWallLength: (id: string, length: number) => void
  updateWallThickness: (id: string, thickness: number) => void
  removeWall: (id: string) => void
  setWallHeight: (height: number) => void
  clearRoom: () => void

  addOpening: (wallId: string, offset: number, type: OpeningType) => void
  moveOpening: (id: string, offset: number) => void
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>) => void
  removeOpening: (id: string) => void

  addUtility: (point: Point, type: UtilityType, mount?: UtilityMount) => void
  moveUtility: (id: string, point: Point) => void
  updateUtility: (id: string, patch: Partial<Omit<Utility, 'id'>>) => void
  removeUtility: (id: string) => void

  addBlock: (block: NewBlock) => void
  /** Точное перемещение: из панели свойств и вида по высоте. */
  moveFurniture: (id: string, position: Point) => void
  /** Перетаскивание на плане: применяет привязки к стенам и соседям. */
  dropFurniture: (id: string, position: Point) => void
  /** Перетаскивание в виде спереди: привязки по горизонтали и по высоте сразу. */
  dropInSection: (id: string, x: number, elevation: number) => void
  elevateFurniture: (id: string, elevation: number) => void
  rotateFurniture: (id: string, rotation: number) => void
  updateFurnitureParams: (id: string, patch: Partial<BlockParams>) => void
  removeFurniture: (id: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      room: createDefaultRoom(),
      furniture: [],
      selection: null,
      tool: 'select',
      orthoSnap: true,
      smartPlacement: true,
      viewMode: 'split',
      editorView: 'plan',
      utilityType: 'water',

      setTool: (tool) => set({ tool, selection: tool === 'select' ? get().selection : null }),
      setUtilityType: (utilityType) => set({ utilityType, tool: 'utility' }),
      setOrthoSnap: (orthoSnap) => set({ orthoSnap }),
      setSmartPlacement: (smartPlacement) => set({ smartPlacement }),
      setViewMode: (viewMode) => set({ viewMode }),
      setEditorView: (editorView) => set({ editorView, tool: editorView === 'elevation' ? 'select' : get().tool }),
      select: (selection) => set({ selection }),

      addWall: (start, end) =>
        set((state) => ({
          room: {
            ...state.room,
            walls: [...state.room.walls, { id: newId(), start, end, thickness: DEFAULT_WALL_THICKNESS }],
          },
        })),

      updateWallLength: (id, length) =>
        set((state) => {
          const widestOpening = state.room.openings
            .filter((opening) => opening.wallId === id)
            .reduce((widest, opening) => Math.max(widest, opening.width), 0)
          const walls = setWallLength(state.room.walls, id, Math.max(length, widestOpening))
          const wall = walls.find((candidate) => candidate.id === id)
          const openings = wall
            ? state.room.openings.map((opening) =>
                opening.wallId === id ? normalizeOpening(opening, wall, state.room.wallHeight) : opening,
              )
            : state.room.openings
          const nextRoom = { ...state.room, walls, openings }
          const utilities = state.room.utilities.flatMap((utility) => {
            const normalized = normalizeUtility(utility, nextRoom)
            return normalized ? [normalized] : []
          })
          return { room: { ...nextRoom, utilities } }
        }),

      updateWallThickness: (id, thickness) =>
        set((state) => ({
          room: {
            ...state.room,
            walls: state.room.walls.map((wall) =>
              wall.id === id
                ? { ...wall, thickness: clamp(thickness, WALL_LIMITS.thickness.min, WALL_LIMITS.thickness.max) }
                : wall,
            ),
          },
        })),

      removeWall: (id) =>
        set((state) => ({
          room: {
            ...state.room,
            walls: state.room.walls.filter((wall) => wall.id !== id),
            openings: state.room.openings.filter((opening) => opening.wallId !== id),
            utilities: state.room.utilities.filter(
              (utility) => utility.mount.kind !== 'wall' || utility.mount.wallId !== id,
            ),
          },
          selection:
            state.selection?.id === id ||
            (state.selection?.kind === 'opening' &&
              state.room.openings.some((opening) => opening.id === state.selection?.id && opening.wallId === id)) ||
            (state.selection?.kind === 'utility' &&
              state.room.utilities.some(
                (utility) =>
                  utility.id === state.selection?.id &&
                  utility.mount.kind === 'wall' &&
                  utility.mount.wallId === id,
              ))
              ? null
              : state.selection,
        })),

      setWallHeight: (height) =>
        set((state) => {
          const wallHeight = clamp(height, WALL_LIMITS.height.min, WALL_LIMITS.height.max)
          return {
            room: {
              ...state.room,
              wallHeight,
              openings: state.room.openings.flatMap((opening) => {
                const wall = state.room.walls.find((candidate) => candidate.id === opening.wallId)
                return wall ? [normalizeOpening(opening, wall, wallHeight)] : []
              }),
              utilities: state.room.utilities.map((utility) => ({
                ...utility,
                height: clamp(utility.height, 0, wallHeight),
              })),
            },
          }
        }),

      clearRoom: () =>
        set({
          room: { walls: [], wallHeight: get().room.wallHeight, openings: [], utilities: [] },
          furniture: [],
          selection: null,
        }),

      addOpening: (wallId, offset, type) => {
        set((state) => {
          const wall = state.room.walls.find((candidate) => candidate.id === wallId)
          if (!wall || wallLength(wall) < OPENING_LIMITS.width.min) return state
          const opening: Opening = normalizeOpening(
            {
              id: newId(),
              wallId,
              type,
              offset,
              hinge: 'left',
              ...OPENING_DEFAULTS[type],
            },
            wall,
            state.room.wallHeight,
          )
          return {
            room: { ...state.room, openings: [...state.room.openings, opening] },
            selection: { kind: 'opening', id: opening.id },
            tool: 'select',
          }
        })
      },

      moveOpening: (id, offset) =>
        set((state) => ({
          room: {
            ...state.room,
            openings: state.room.openings.map((opening) => {
              if (opening.id !== id) return opening
              const wall = state.room.walls.find((candidate) => candidate.id === opening.wallId)
              return wall
                ? normalizeOpening({ ...opening, offset: Math.round(offset) }, wall, state.room.wallHeight)
                : opening
            }),
          },
        })),

      updateOpening: (id, patch) =>
        set((state) => ({
          room: {
            ...state.room,
            openings: state.room.openings.map((opening) => {
              if (opening.id !== id) return opening
              const wall = state.room.walls.find((candidate) => candidate.id === opening.wallId)
              return wall ? normalizeOpening({ ...opening, ...patch }, wall, state.room.wallHeight) : opening
            }),
          },
        })),

      removeOpening: (id) =>
        set((state) => ({
          room: { ...state.room, openings: state.room.openings.filter((opening) => opening.id !== id) },
          selection: state.selection?.id === id ? null : state.selection,
        })),

      addUtility: (point, type, mount = { kind: 'floor' }) => {
        const utility: Utility = {
          id: newId(),
          type,
          point: { x: Math.round(point.x), y: Math.round(point.y) },
          mount,
          height: Math.min(mount.kind === 'floor' ? 0 : UTILITY_DEFAULT_HEIGHT[type], get().room.wallHeight),
        }
        const placed = normalizeUtility(utility, get().room) ?? utility
        set((state) => ({
          room: { ...state.room, utilities: [...state.room.utilities, placed] },
          selection: { kind: 'utility', id: placed.id },
          tool: 'select',
        }))
      },

      moveUtility: (id, point) =>
        set((state) => ({
          room: {
            ...state.room,
            utilities: state.room.utilities.map((utility) =>
              utility.id === id ? moveUtilityToPoint(utility, point, state.room) : utility,
            ),
          },
        })),

      updateUtility: (id, patch) =>
        set((state) => ({
          room: {
            ...state.room,
            utilities: state.room.utilities.flatMap((utility) => {
              if (utility.id !== id) return [utility]
              const next = {
                ...utility,
                ...patch,
                height: clamp(patch.height ?? utility.height, 0, state.room.wallHeight),
              }
              const normalized = normalizeUtility(next, state.room)
              return normalized ? [normalized] : []
            }),
          },
        })),

      removeUtility: (id) =>
        set((state) => ({
          room: { ...state.room, utilities: state.room.utilities.filter((utility) => utility.id !== id) },
          selection: state.selection?.id === id ? null : state.selection,
        })),

      addBlock: (block) => {
        const state = get()
        const polygon = roomPolygon(state.room.walls)
        const center = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
        const item: FurnitureItem = {
          id: newId(),
          type: block.type,
          position: center,
          elevation: block.elevation,
          rotation: 0,
          params: clampParams(block.type, block.params),
        }
        set({ furniture: [...state.furniture, item], selection: { kind: 'furniture', id: item.id }, tool: 'select' })
      },

      moveFurniture: (id, position) =>
        set((state) => ({
          furniture: state.furniture.map((item) => (item.id === id ? { ...item, position } : item)),
        })),

      dropFurniture: (id, position) =>
        set((state) => {
          const item = state.furniture.find((candidate) => candidate.id === id)
          if (!item) return state
          const polygon = roomPolygon(state.room.walls)
          const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
          const others = state.furniture.filter((candidate) => candidate.id !== id)
          const placement = placeBlock(item, position, state.room, others, roomCenter, state.smartPlacement)
          // Блок, переехавший на столешницу, должен врезаться в неё и по высоте.
          const moved = { ...item, position: placement.position, rotation: placement.rotation }
          const elevation = state.smartPlacement ? snapElevation(moved, item.elevation, others) : item.elevation
          return {
            furniture: state.furniture.map((candidate) =>
              candidate.id === id ? { ...moved, elevation } : candidate,
            ),
          }
        }),

      dropInSection: (id, x, elevation) =>
        set((state) => {
          const item = state.furniture.find((candidate) => candidate.id === id)
          if (!item) return state
          const polygon = roomPolygon(state.room.walls)
          const roomCenter = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
          const others = state.furniture.filter((candidate) => candidate.id !== id)
          const placement = placeBlockInSection(
            item,
            x,
            elevation,
            state.room,
            others,
            roomCenter,
            state.smartPlacement,
          )
          const limited = clamp(placement.elevation, 0, Math.max(0, state.room.wallHeight - item.params.height))
          return {
            furniture: state.furniture.map((candidate) =>
              candidate.id === id
                ? { ...candidate, position: placement.position, rotation: placement.rotation, elevation: limited }
                : candidate,
            ),
          }
        }),

      elevateFurniture: (id, elevation) =>
        set((state) => ({
          furniture: state.furniture.map((item) =>
            item.id === id
              ? {
                  ...item,
                  elevation: clamp(elevation, 0, Math.max(0, state.room.wallHeight - item.params.height)),
                }
              : item,
          ),
        })),

      rotateFurniture: (id, rotation) =>
        set((state) => ({
          furniture: state.furniture.map((item) =>
            item.id === id ? { ...item, rotation: ((rotation % 360) + 360) % 360 } : item,
          ),
        })),

      updateFurnitureParams: (id, patch) =>
        set((state) => ({
          furniture: state.furniture.map((item) =>
            item.id === id ? { ...item, params: clampParams(item.type, { ...item.params, ...patch }) } : item,
          ),
        })),

      removeFurniture: (id) =>
        set((state) => ({
          furniture: state.furniture.filter((item) => item.id !== id),
          selection: state.selection?.id === id ? null : state.selection,
        })),
    }),
    {
      name: 'future-furniture-project',
      partialize: (state) => ({ room: state.room, furniture: state.furniture, viewMode: state.viewMode }),
      merge: (persisted, current) => {
        const parsed = projectSchema.safeParse(persisted)
        if (!parsed.success) return current
        const viewMode = (persisted as { viewMode?: ViewMode }).viewMode
        const room = parsed.data.room
        const openings = room.openings.flatMap((opening) => {
          const wall = room.walls.find((candidate) => candidate.id === opening.wallId)
          return wall && wallLength(wall) >= OPENING_LIMITS.width.min
            ? [normalizeOpening(opening, wall, room.wallHeight)]
            : []
        })
        const utilities = room.utilities.flatMap((utility) => {
          const normalized = normalizeUtility(utility, room)
          return normalized ? [{ ...normalized, point: utilityPoint(normalized, room) }] : []
        })
        return {
          ...current,
          ...parsed.data,
          room: { ...room, openings, utilities },
          viewMode: viewMode ?? current.viewMode,
        }
      },
    },
  ),
)

export const selectedFurniture = (state: AppState) =>
  state.selection?.kind === 'furniture'
    ? (state.furniture.find((item) => item.id === state.selection!.id) ?? null)
    : null

export const selectedWall = (state: AppState) =>
  state.selection?.kind === 'wall'
    ? (state.room.walls.find((wall) => wall.id === state.selection!.id) ?? null)
    : null

export const selectedOpening = (state: AppState) =>
  state.selection?.kind === 'opening'
    ? (state.room.openings.find((opening) => opening.id === state.selection!.id) ?? null)
    : null

export const selectedUtility = (state: AppState) =>
  state.selection?.kind === 'utility'
    ? (state.room.utilities.find((utility) => utility.id === state.selection!.id) ?? null)
    : null
