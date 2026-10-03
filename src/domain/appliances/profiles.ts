import type { FurnitureItem, HobConnection, UtilityType } from '@/domain/model'
import { cabinetModuleFor, type CabinetModuleConfig } from '@/domain/modules/cabinetFamilies'

export type ApplianceKind = 'hob' | 'oven' | 'dishwasher' | 'fridge'

export function hobConnectionFor(item: FurnitureItem): HobConnection {
  return item.hobConnection ?? 'unknown'
}

/** Точные токи, линии питания и монтажные зазоры зависят от выбранной модели и здесь не подтверждаются. */
export function hobUtilityType(connection: HobConnection): UtilityType | null {
  if (connection === 'gas') return 'gas'
  if (connection === 'electric' || connection === 'induction') return 'power'
  return null
}

export function cabinetAppliance(item: FurnitureItem): ApplianceKind | null {
  const module = cabinetModuleFor(item)
  if (!module) return null
  if (module.familyId === 'base-storage' && (module.role === 'oven' || module.role === 'dishwasher')) return module.role
  if (module.familyId === 'tall-storage' && (module.role === 'oven' || module.role === 'fridge')) return module.role
  return null
}

export function applianceUtilityTypes(kind: ApplianceKind): UtilityType[] {
  switch (kind) {
    case 'oven':
    case 'fridge':
      return ['power']
    case 'dishwasher':
      return ['water', 'sewer', 'power']
    case 'hob':
      return []
  }
}

/** Ограничения относятся к типовым эскизным посадочным местам, не к конкретной модели. */
export function applianceModuleWidths(module: CabinetModuleConfig): readonly number[] | null {
  if (module.familyId === 'base-storage' && module.role === 'dishwasher') return [450, 600]
  if (module.familyId === 'base-storage' && module.role === 'oven') return [600]
  if (module.familyId === 'tall-storage' && (module.role === 'oven' || module.role === 'fridge')) return [600]
  return null
}
