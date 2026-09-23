import type { BlockType, FurnitureItem, Opening, OpeningType, Room, Utility, UtilityType, Wall } from '@/domain/model'

export const RECT_WALLS: Wall[] = [
  { id: 'top', start: { x: 0, y: 0 }, end: { x: 3600, y: 0 }, thickness: 100 },
  { id: 'right', start: { x: 3600, y: 0 }, end: { x: 3600, y: 3000 }, thickness: 100 },
  { id: 'bottom', start: { x: 3600, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 100 },
  { id: 'left', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 100 },
]

export function makeRoom(patch: Partial<Room> = {}): Room {
  return {
    walls: RECT_WALLS.map((wall) => ({ ...wall, start: { ...wall.start }, end: { ...wall.end } })),
    wallHeight: 2700,
    openings: [],
    utilities: [],
    ...patch,
  }
}

export function makeOpening(type: OpeningType, patch: Partial<Opening> = {}): Opening {
  return {
    id: `${type}-1`,
    wallId: 'top',
    type,
    offset: 1800,
    width: type === 'door' ? 800 : 1200,
    height: type === 'door' ? 2100 : 1400,
    sill: type === 'door' ? 0 : 900,
    hinge: 'left',
    ...patch,
  }
}

export function makeUtility(type: UtilityType, patch: Partial<Utility> = {}): Utility {
  return {
    id: `${type}-1`,
    type,
    point: { x: 1800, y: 330 },
    height: 0,
    mount: { kind: 'floor' },
    ...patch,
  }
}

const DEFAULT_PARAMS: Record<BlockType, FurnitureItem['params']> = {
  cabinet: { width: 600, height: 820, depth: 560, facadeColor: '#d6c09a' },
  countertop: { width: 2400, height: 38, depth: 600, facadeColor: '#8b8f97' },
  sink: { width: 600, height: 180, depth: 500, facadeColor: '#aeb4bd' },
  hob: { width: 600, height: 50, depth: 520, facadeColor: '#252931' },
}

export function makeFurniture(type: BlockType = 'cabinet', patch: Partial<FurnitureItem> = {}): FurnitureItem {
  return {
    id: `${type}-1`,
    type,
    position: { x: 1800, y: 330 },
    elevation: type === 'sink' ? 690 : type === 'hob' ? 780 : 0,
    rotation: 0,
    params: { ...DEFAULT_PARAMS[type] },
    ...patch,
  }
}
