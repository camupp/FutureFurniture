import {
  type BlockParams,
  type BlockType,
  type Opening,
  type OpeningType,
  type Point,
  type Project,
  type Utility,
  type UtilityMount,
  type UtilityType,
} from '@/domain/model'
import type { ProjectHistory } from './history'

export type Tool = 'select' | 'wall' | 'window' | 'door' | 'utility' | 'pan'
export type ViewMode = '2d' | 'split' | '3d'
/** Что показывает 2D-холст: план сверху или вид по высоте. */
export type EditorView = 'plan' | 'elevation'
export type SelectionKind = 'wall' | 'furniture' | 'opening' | 'utility'
export type Selection = { kind: SelectionKind; id: string } | null

/** Данные пресета каталога, которых достаточно, чтобы создать блок. */
export type NewBlock = { type: BlockType; elevation: number; params: BlockParams }

export type AppState = Project & {
  history: ProjectHistory
  /** Changes only on undo/redo to cancel obsolete canvas drafts. */
  historyRevision: number
  undo: () => void
  redo: () => void
  beginHistoryGroup: () => void
  endHistoryGroup: () => void
  selection: Selection
  tool: Tool
  orthoSnap: boolean
  smartPlacement: boolean
  viewMode: ViewMode
  editorView: EditorView
  /** Стена, внутренний фасад которой открыт в редакторе по высоте. */
  elevationWallId: string | null
  /** Какой вывод ставит инструмент «Коммуникация». */
  utilityType: UtilityType

  setTool: (tool: Tool) => void
  setUtilityType: (type: UtilityType) => void
  setOrthoSnap: (enabled: boolean) => void
  setSmartPlacement: (enabled: boolean) => void
  setViewMode: (mode: ViewMode) => void
  setEditorView: (view: EditorView) => void
  setElevationWall: (wallId: string) => void
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
  addCountertopForRow: (cabinetId: string) => void
  detachCountertop: (id: string) => void
  /** Точное перемещение: из панели свойств и вида по высоте. */
  moveFurniture: (id: string, position: Point) => void
  moveFurnitureAlongWall: (id: string, offset: number) => void
  detachFurniture: (id: string) => void
  /** Перетаскивание на плане: применяет привязки к стенам и соседям. */
  dropFurniture: (id: string, position: Point) => void
  /** Перетаскивание в виде спереди: привязки по горизонтали и по высоте сразу. */
  dropInSection: (id: string, x: number, elevation: number) => void
  elevateFurniture: (id: string, elevation: number) => void
  rotateFurniture: (id: string, rotation: number) => void
  updateFurnitureParams: (id: string, patch: Partial<BlockParams>) => void
  removeFurniture: (id: string) => void
}

export type StatePatch = Partial<AppState> | ((state: AppState) => Partial<AppState>)
export type SliceContext = { set: (update: StatePatch) => void; get: () => AppState; newId: () => string }
