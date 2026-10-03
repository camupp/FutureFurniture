import { syncAutoCountertops } from '@/domain/assemblies/countertops'
import { expandFurnitureGroups, followMovedHosts, pruneFurnitureGroups } from '@/domain/assemblies/furnitureGroups'
import type { AppState } from './types'

/** Производные сборки обновляются до уведомления подписчиков и записи в storage. */
export function synchronizeProjectChange(
  state: AppState,
  patch: Partial<AppState>,
  newId: () => string,
): Partial<AppState> {
  const next = { ...state, ...patch }
  if (next.furniture === state.furniture && next.room.walls === state.room.walls) {
    if (patch.selection === undefined || patch.selectedFurnitureIds !== undefined) return patch
    return {
      ...patch,
      selectedFurnitureIds:
        patch.selection?.kind === 'furniture' ? expandFurnitureGroups(state.furniture, [patch.selection.id]) : [],
    }
  }
  const withHosts =
    next.furniture === state.furniture ? next.furniture : followMovedHosts(state.furniture, next.furniture)
  const furniture = pruneFurnitureGroups(syncAutoCountertops(withHosts, next.room, newId))
  const selection =
    next.selection?.kind === 'furniture' && !furniture.some((item) => item.id === next.selection?.id)
      ? null
      : next.selection
  const selectedFurnitureIds =
    selection?.kind === 'furniture'
      ? expandFurnitureGroups(
          furniture,
          patch.selectedFurnitureIds ?? (patch.selection !== undefined ? [selection.id] : state.selectedFurnitureIds),
        )
      : []
  return { ...patch, furniture, selection, selectedFurnitureIds }
}
