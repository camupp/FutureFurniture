import type { AppState, SliceContext } from '../types'
import { expandFurnitureGroups } from '@/domain/assemblies/furnitureGroups'

export function createEditorSlice({
  set,
  get,
}: SliceContext): Pick<
  AppState,
  | 'setTool'
  | 'setUtilityType'
  | 'setOrthoSnap'
  | 'setSmartPlacement'
  | 'setViewMode'
  | 'setEditorView'
  | 'setElevationWall'
  | 'select'
  | 'selectFurniture'
  | 'selectFurnitureInMarquee'
> {
  return {
    setTool: (tool) =>
      set({
        tool,
        selection: tool === 'select' ? get().selection : null,
        selectedFurnitureIds: tool === 'select' ? get().selectedFurnitureIds : [],
      }),
    setUtilityType: (utilityType) => set({ utilityType, tool: 'utility' }),
    setOrthoSnap: (orthoSnap) => set({ orthoSnap }),
    setSmartPlacement: (smartPlacement) => set({ smartPlacement }),
    setViewMode: (viewMode) => set({ viewMode }),
    setEditorView: (editorView) =>
      set((state) => {
        if (editorView === 'plan') return { editorView, tool: state.tool }
        let selectedWallId: string | undefined
        if (state.selection?.kind === 'wall') selectedWallId = state.selection.id
        if (state.selection?.kind === 'furniture') {
          selectedWallId = state.furniture.find((item) => item.id === state.selection?.id)?.wallAnchor?.wallId
        }
        if (state.selection?.kind === 'opening') {
          selectedWallId = state.room.openings.find((opening) => opening.id === state.selection?.id)?.wallId
        }
        if (state.selection?.kind === 'utility') {
          const utility = state.room.utilities.find((candidate) => candidate.id === state.selection?.id)
          selectedWallId = utility?.mount.kind === 'wall' ? utility.mount.wallId : undefined
        }
        const elevationWallId =
          selectedWallId && state.room.walls.some((wall) => wall.id === selectedWallId)
            ? selectedWallId
            : state.room.walls.some((wall) => wall.id === state.elevationWallId)
              ? state.elevationWallId
              : (state.room.walls[0]?.id ?? null)
        return { editorView, elevationWallId, tool: 'select' }
      }),
    setElevationWall: (elevationWallId) =>
      set((state) =>
        state.room.walls.some((wall) => wall.id === elevationWallId) ? { elevationWallId, selection: null } : state,
      ),
    select: (selection) =>
      set((state) => {
        const selectedFurnitureIds =
          selection?.kind === 'furniture' ? expandFurnitureGroups(state.furniture, [selection.id]) : []
        if (selection?.kind === 'wall') return { selection, selectedFurnitureIds, elevationWallId: selection.id }
        if (selection?.kind === 'furniture') {
          const wallId = state.furniture.find((item) => item.id === selection.id)?.wallAnchor?.wallId
          if (wallId) return { selection, selectedFurnitureIds, elevationWallId: wallId }
        }
        if (selection?.kind === 'opening') {
          const wallId = state.room.openings.find((opening) => opening.id === selection.id)?.wallId
          if (wallId) return { selection, selectedFurnitureIds, elevationWallId: wallId }
        }
        if (selection?.kind === 'utility') {
          const utility = state.room.utilities.find((candidate) => candidate.id === selection.id)
          if (utility?.mount.kind === 'wall')
            return { selection, selectedFurnitureIds, elevationWallId: utility.mount.wallId }
        }
        return { selection, selectedFurnitureIds }
      }),
    selectFurniture: (id, additive = false) =>
      set((state) => {
        const clicked = expandFurnitureGroups(state.furniture, [id])
        if (!clicked.length) return state
        let selectedFurnitureIds: string[]
        if (additive) {
          const allSelected = clicked.every((candidate) => state.selectedFurnitureIds.includes(candidate))
          selectedFurnitureIds = allSelected
            ? state.selectedFurnitureIds.filter((candidate) => !clicked.includes(candidate))
            : expandFurnitureGroups(state.furniture, [...state.selectedFurnitureIds, ...clicked])
        } else {
          selectedFurnitureIds = state.selectedFurnitureIds.includes(id) ? state.selectedFurnitureIds : clicked
        }
        return {
          selectedFurnitureIds,
          selection: selectedFurnitureIds.length
            ? { kind: 'furniture' as const, id: selectedFurnitureIds.includes(id) ? id : selectedFurnitureIds[0]! }
            : null,
        }
      }),
    selectFurnitureInMarquee: (ids, additive = false) =>
      set((state) => {
        const selectedFurnitureIds = expandFurnitureGroups(
          state.furniture,
          additive ? [...state.selectedFurnitureIds, ...ids] : ids,
        )
        return {
          selectedFurnitureIds,
          selection: selectedFurnitureIds.length ? { kind: 'furniture' as const, id: selectedFurnitureIds[0]! } : null,
        }
      }),
  }
}
