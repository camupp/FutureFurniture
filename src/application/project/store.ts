import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, SliceContext } from './types'
import { createInitialData } from './initialState'
import { synchronizeProjectChange } from './transaction'
import { mergePersistedProject, partializeProject, PROJECT_STORAGE_KEY } from './persistence'
import { createEditorSlice } from './slices/editorSlice'
import { createRoomSlice } from './slices/roomSlice'
import { createOpeningsSlice } from './slices/openingsSlice'
import { createUtilitiesSlice } from './slices/utilitiesSlice'
import { createFurnitureSlice } from './slices/furnitureSlice'

const newId = () => crypto.randomUUID()

export const useAppStore = create<AppState>()(
  persist(
    (rawSet, get) => {
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
    },
    {
      name: PROJECT_STORAGE_KEY,
      partialize: partializeProject,
      merge: (persisted, current) => mergePersistedProject(persisted, current, newId),
    },
  ),
)
