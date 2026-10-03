import { projectSchema, type FurnitureItem } from '@/domain/model'
import { straightKitchenSourceSignature } from '@/domain/generation/straightKitchen'
import { boundaryWalls } from '@/domain/geometry/geometry'
import { itemPlacementIssues } from '@/domain/validation/rules'
import type { AppState, SliceContext } from '../types'

export function createGeneratorSlice({ set, get, newId }: SliceContext): Pick<AppState, 'applyStraightKitchen'> {
  return {
    applyStraightKitchen: (proposal, expectedProjectId) => {
      const state = get()
      if (state.activeProjectId !== expectedProjectId) return 'Сейчас открыт другой проект. Пересчитайте вариант.'
      if (straightKitchenSourceSignature(state.room, state.furniture) !== proposal.sourceSignature)
        return 'Проект изменился после предпросмотра. Пересчитайте вариант.'
      if (!boundaryWalls(state.room.walls).some((wall) => wall.id === proposal.wallId))
        return 'Выбранная стена больше не входит во внешний контур.'
      const proposedIds = new Set(proposal.items.map((item) => item.id))
      if (proposedIds.size !== proposal.items.length || state.furniture.some((item) => proposedIds.has(item.id)))
        return 'У предложения повторяются идентификаторы блоков.'
      const cabinetIds = new Set(proposal.items.filter((item) => item.type === 'cabinet').map((item) => item.id))
      if (
        cabinetIds.size === 0 ||
        proposal.items.some((item) => item.autoCountertop?.supportIds.some((id) => !cabinetIds.has(id)))
      )
        return 'У предложения нет корректных опор для столешницы.'
      const combined = [...state.furniture, ...proposal.items]
      if (
        !projectSchema.safeParse({ room: state.room, furniture: combined }).success ||
        proposal.items.some((item) => itemPlacementIssues(item, combined, state.room).length > 0)
      )
        return 'Предложение больше не проходит проверку размещения.'

      const ids = new Map(proposal.items.map((item) => [item.id, newId()]))
      const accepted: FurnitureItem[] = proposal.items.map((item) => ({
        ...item,
        id: ids.get(item.id)!,
        ...(item.autoCountertop
          ? {
              autoCountertop: {
                ...item.autoCountertop,
                supportIds: item.autoCountertop.supportIds.map((id) => ids.get(id) ?? id),
              },
            }
          : {}),
      }))
      set({
        furniture: [...state.furniture, ...accepted],
        selection: { kind: 'furniture', id: accepted.find((item) => item.type === 'cabinet')!.id },
        tool: 'select',
      })
      return null
    },
  }
}
