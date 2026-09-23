import { WALL_LIMITS } from '@/domain/model'
import { setWallLength } from '@/domain/geometry/geometry'
import { normalizeOpening } from '@/domain/room/openings'
import { clamp } from '@/shared/lib/units'
import { normalizeUtility } from '@/domain/room/utilities'
import { detachFromWall, syncFurnitureToWalls } from '@/domain/placement/wallAnchors'
import { DEFAULT_WALL_THICKNESS } from '../initialState'
import type { AppState, SliceContext } from '../types'

export function createRoomSlice({
  set,
  get,
  newId,
}: SliceContext): Pick<
  AppState,
  'addWall' | 'updateWallLength' | 'updateWallThickness' | 'removeWall' | 'setWallHeight' | 'clearRoom'
> {
  return {
    addWall: (start, end) =>
      set((state) => {
        const wall = { id: newId(), start, end, thickness: DEFAULT_WALL_THICKNESS }
        return {
          room: { ...state.room, walls: [...state.room.walls, wall] },
          elevationWallId: state.elevationWallId ?? wall.id,
        }
      }),

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
        return {
          room: { ...nextRoom, utilities },
          furniture: syncFurnitureToWalls(state.furniture, walls),
        }
      }),

    updateWallThickness: (id, thickness) =>
      set((state) => {
        const walls = state.room.walls.map((wall) =>
          wall.id === id
            ? { ...wall, thickness: clamp(thickness, WALL_LIMITS.thickness.min, WALL_LIMITS.thickness.max) }
            : wall,
        )
        return {
          room: { ...state.room, walls },
          furniture: syncFurnitureToWalls(state.furniture, walls),
        }
      }),

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
        furniture: state.furniture.map((item) => (item.wallAnchor?.wallId === id ? detachFromWall(item) : item)),
        elevationWallId:
          state.elevationWallId === id
            ? (state.room.walls.find((wall) => wall.id !== id)?.id ?? null)
            : state.elevationWallId,
        selection:
          state.selection?.id === id ||
          (state.selection?.kind === 'opening' &&
            state.room.openings.some((opening) => opening.id === state.selection?.id && opening.wallId === id)) ||
          (state.selection?.kind === 'utility' &&
            state.room.utilities.some(
              (utility) =>
                utility.id === state.selection?.id && utility.mount.kind === 'wall' && utility.mount.wallId === id,
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
        elevationWallId: null,
      }),
  }
}
