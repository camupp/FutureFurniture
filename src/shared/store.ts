import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CABINET_LIMITS,
  DEFAULT_CABINET,
  projectSchema,
  WALL_LIMITS,
  type CabinetParams,
  type FurnitureItem,
  type Point,
  type Project,
  type Room,
  type Wall,
} from './types'
import { bounds, roomPolygon, setWallLength } from './utils/geometry'
import { clamp } from './utils/units'

export type Tool = 'select' | 'wall' | 'pan'
export type ViewMode = '2d' | 'split' | '3d'
/** Что показывает 2D-холст: план сверху или вид по высоте. */
export type EditorView = 'plan' | 'elevation'
export type Selection = { kind: 'wall'; id: string } | { kind: 'furniture'; id: string } | null

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
  return { walls, wallHeight: DEFAULT_WALL_HEIGHT }
}

function clampParams(params: CabinetParams): CabinetParams {
  return {
    ...params,
    width: clamp(params.width, CABINET_LIMITS.width.min, CABINET_LIMITS.width.max),
    height: clamp(params.height, CABINET_LIMITS.height.min, CABINET_LIMITS.height.max),
    depth: clamp(params.depth, CABINET_LIMITS.depth.min, CABINET_LIMITS.depth.max),
  }
}

type AppState = Project & {
  selection: Selection
  tool: Tool
  orthoSnap: boolean
  viewMode: ViewMode
  editorView: EditorView

  setTool: (tool: Tool) => void
  setOrthoSnap: (enabled: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setEditorView: (view: EditorView) => void
  select: (selection: Selection) => void

  addWall: (start: Point, end: Point) => void
  updateWallLength: (id: string, length: number) => void
  updateWallThickness: (id: string, thickness: number) => void
  removeWall: (id: string) => void
  setWallHeight: (height: number) => void
  clearRoom: () => void

  addCabinet: () => void
  moveFurniture: (id: string, position: Point) => void
  elevateFurniture: (id: string, elevation: number) => void
  rotateFurniture: (id: string, rotation: number) => void
  updateFurnitureParams: (id: string, patch: Partial<CabinetParams>) => void
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
      viewMode: 'split',
      editorView: 'plan',

      setTool: (tool) => set({ tool, selection: tool === 'select' ? get().selection : null }),
      setOrthoSnap: (orthoSnap) => set({ orthoSnap }),
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
        set((state) => ({ room: { ...state.room, walls: setWallLength(state.room.walls, id, length) } })),

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
          room: { ...state.room, walls: state.room.walls.filter((wall) => wall.id !== id) },
          selection: state.selection?.id === id ? null : state.selection,
        })),

      setWallHeight: (height) =>
        set((state) => ({
          room: { ...state.room, wallHeight: clamp(height, WALL_LIMITS.height.min, WALL_LIMITS.height.max) },
        })),

      clearRoom: () => set({ room: { walls: [], wallHeight: get().room.wallHeight }, furniture: [], selection: null }),

      addCabinet: () => {
        const state = get()
        const polygon = roomPolygon(state.room.walls)
        const center = polygon.length ? bounds(polygon).center : { x: 0, y: 0 }
        const item: FurnitureItem = {
          id: newId(),
          type: 'cabinet',
          position: center,
          elevation: 0,
          rotation: 0,
          params: { ...DEFAULT_CABINET },
        }
        set({ furniture: [...state.furniture, item], selection: { kind: 'furniture', id: item.id }, tool: 'select' })
      },

      moveFurniture: (id, position) =>
        set((state) => ({
          furniture: state.furniture.map((item) => (item.id === id ? { ...item, position } : item)),
        })),

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
            item.id === id ? { ...item, params: clampParams({ ...item.params, ...patch }) } : item,
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
        return { ...current, ...parsed.data, viewMode: viewMode ?? current.viewMode }
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
