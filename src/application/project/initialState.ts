import { type Point, type Room, type Wall } from '@/domain/model'
import type { AppState } from './types'

export const DEFAULT_WALL_THICKNESS = 100
const DEFAULT_WALL_HEIGHT = 2700

function createDefaultRoom(newId: () => string): Room {
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
    kind: 'boundary',
    start: corner,
    end: corners[(i + 1) % corners.length],
    thickness: DEFAULT_WALL_THICKNESS,
  }))
  return { walls, wallHeight: DEFAULT_WALL_HEIGHT, openings: [], utilities: [] }
}

export function createInitialData(newId: () => string) {
  return {
    room: createDefaultRoom(newId),
    furniture: [],
    activeProjectId: null,
    selection: null,
    selectedFurnitureIds: [],
    tool: 'select',
    orthoSnap: true,
    smartPlacement: true,
    viewMode: 'split',
    editorView: 'plan',
    elevationWallId: null,
    utilityType: 'water',
  } satisfies Pick<
    AppState,
    | 'room'
    | 'furniture'
    | 'activeProjectId'
    | 'selection'
    | 'selectedFurnitureIds'
    | 'tool'
    | 'orthoSnap'
    | 'smartPlacement'
    | 'viewMode'
    | 'editorView'
    | 'elevationWallId'
    | 'utilityType'
  >
}
