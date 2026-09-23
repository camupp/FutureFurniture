import { create } from 'zustand'
import type { AppState, SliceContext } from './types'
import { createInitialData } from './initialState'
import { synchronizeProjectChange } from './transaction'
import { createEditorSlice } from './slices/editorSlice'
import { createRoomSlice } from './slices/roomSlice'
import { createOpeningsSlice } from './slices/openingsSlice'
import { createUtilitiesSlice } from './slices/utilitiesSlice'
import { createFurnitureSlice } from './slices/furnitureSlice'

const newId = () => crypto.randomUUID()

export const useAppStore = create<AppState>()((rawSet, get) => {
  const set: SliceContext['set'] = (update) =>
    rawSet((state) => synchronizeProjectChange(state, typeof update === 'function' ? update(state) : update, newId))
  const context = { set, get, newId }
  return {
    ...createInitialData(newId),
    ...createEditorSlice(context),
    ...createRoomSlice(context),
    ...createOpeningsSlice(context),
    ...createUtilitiesSlice(context),
    ...createFurnitureSlice(context),
  }
})
