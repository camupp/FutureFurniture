import { OPENING_DEFAULTS, OPENING_LIMITS, type Opening } from '@/domain/model'
import { wallLength } from '@/domain/geometry/geometry'
import { normalizeOpening } from '@/domain/room/openings'
import type { AppState, SliceContext } from '../types'

export function createOpeningsSlice({
  set,
  newId,
}: SliceContext): Pick<AppState, 'addOpening' | 'moveOpening' | 'updateOpening' | 'removeOpening'> {
  return {
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
  }
}
