import { UTILITY_DEFAULT_HEIGHT, type Utility } from '@/domain/model'
import { clamp } from '@/shared/lib/units'
import { moveUtilityToPoint, normalizeUtility } from '@/domain/room/utilities'
import type { AppState, SliceContext } from '../types'

export function createUtilitiesSlice({
  set,
  get,
  newId,
}: SliceContext): Pick<AppState, 'addUtility' | 'moveUtility' | 'updateUtility' | 'removeUtility'> {
  return {
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
  }
}
