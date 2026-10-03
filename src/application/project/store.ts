import { create } from 'zustand'
import type { AppState, SliceContext } from './types'
import { createInitialData } from './initialState'
import { synchronizeProjectChange } from './transaction'
import { createEditorSlice } from './slices/editorSlice'
import { createRoomSlice } from './slices/roomSlice'
import { createOpeningsSlice } from './slices/openingsSlice'
import { createUtilitiesSlice } from './slices/utilitiesSlice'
import { createFurnitureSlice } from './slices/furnitureSlice'
import { createGeneratorSlice } from './slices/generatorSlice'
import { emptyHistory, finishHistoryGroup, recordProjectChange, startHistoryGroup, travelHistory } from './history'
import { expandFurnitureGroups } from '@/domain/assemblies/furnitureGroups'

const newId = () => crypto.randomUUID()

export const useAppStore = create<AppState>()((rawSet, get) => {
  const set: SliceContext['set'] = (update) =>
    rawSet((state) => {
      const patch = synchronizeProjectChange(state, typeof update === 'function' ? update(state) : update, newId)
      return { ...patch, history: recordProjectChange(state.history, state, { ...state, ...patch }) }
    })
  const travel = (direction: 'undo' | 'redo') =>
    rawSet((state) => {
      const { project, history } = travelHistory(state.history, state, direction)
      if (project === state) return history === state.history ? state : { history }
      // Restore the already synchronized snapshot, including generated IDs, in one notification.
      const selection = state.selection
      const selectedObjects =
        selection?.kind === 'furniture'
          ? project.furniture
          : selection?.kind === 'wall'
            ? project.room.walls
            : selection?.kind === 'opening'
              ? project.room.openings
              : project.room.utilities
      return {
        ...project,
        history,
        historyRevision: state.historyRevision + 1,
        selection: selection && selectedObjects.some((item) => item.id === selection.id) ? selection : null,
        selectedFurnitureIds:
          selection?.kind === 'furniture'
            ? expandFurnitureGroups(
                project.furniture,
                state.selectedFurnitureIds.filter((id) => project.furniture.some((item) => item.id === id)),
              )
            : [],
        elevationWallId: project.room.walls.some((wall) => wall.id === state.elevationWallId)
          ? state.elevationWallId
          : (project.room.walls[0]?.id ?? null),
      }
    })
  const context = { set, get, newId }
  return {
    ...createInitialData(newId),
    history: emptyHistory(),
    historyRevision: 0,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    beginHistoryGroup: () => rawSet((state) => ({ history: startHistoryGroup(state.history, state) })),
    endHistoryGroup: () => rawSet((state) => ({ history: finishHistoryGroup(state.history) })),
    ...createEditorSlice(context),
    ...createRoomSlice(context),
    ...createOpeningsSlice(context),
    ...createUtilitiesSlice(context),
    ...createFurnitureSlice(context),
    ...createGeneratorSlice(context),
  }
})
