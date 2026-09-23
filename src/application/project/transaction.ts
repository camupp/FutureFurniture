import { syncAutoCountertops } from '@/domain/assemblies/countertops'
import type { AppState } from './types'

/** Производные сборки обновляются до уведомления подписчиков и записи в storage. */
export function synchronizeProjectChange(
  state: AppState,
  patch: Partial<AppState>,
  newId: () => string,
): Partial<AppState> {
  const next = { ...state, ...patch }
  if (next.furniture === state.furniture && next.room.walls === state.room.walls) return patch
  const furniture = syncAutoCountertops(next.furniture, next.room, newId)
  const selection =
    next.selection?.kind === 'furniture' && !furniture.some((item) => item.id === next.selection?.id)
      ? null
      : next.selection
  return { ...patch, furniture, selection }
}
