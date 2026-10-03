export const CABINET_FACADE_IDS = [
  'single-door',
  'double-door',
  'three-drawers',
  'lift-up',
  'full-door',
  'stacked-doors',
] as const
export type CabinetFacadeId = (typeof CABINET_FACADE_IDS)[number]

export const CABINET_HANDLE_STYLES = ['bar', 'knob'] as const
export type CabinetHandleStyle = (typeof CABINET_HANDLE_STYLES)[number]
export const CABINET_HANDLE_SIDES = ['left', 'right'] as const
export type CabinetHandleSide = (typeof CABINET_HANDLE_SIDES)[number]

type Hardware = { handleStyle?: CabinetHandleStyle; handleSide?: CabinetHandleSide }
export const BASE_CABINET_ROLES = ['storage', 'sink', 'hob', 'oven', 'dishwasher'] as const
export type BaseCabinetRole = (typeof BASE_CABINET_ROLES)[number]
export const TALL_CABINET_ROLES = ['storage', 'oven', 'fridge'] as const
export type TallCabinetRole = (typeof TALL_CABINET_ROLES)[number]
export type CabinetModuleConfig =
  | ({
      familyId: 'base-storage'
      version: 1
      facade: 'single-door' | 'double-door' | 'three-drawers'
      role?: BaseCabinetRole
    } & Hardware)
  | ({ familyId: 'wall-storage'; version: 1; facade: 'single-door' | 'double-door' | 'lift-up' } & Hardware)
  | ({ familyId: 'tall-storage'; version: 1; facade: 'stacked-doors' | 'full-door'; role?: TallCabinetRole } & Hardware)

type Dimension = { min: number; max: number; step: number; preferred: readonly number[] }
export type CabinetFacadeDefinition = { id: CabinetFacadeId; label: string; minWidth: number; maxWidth: number }
type CabinetFamilyDefinition = {
  id: string
  version: 1
  purpose: string
  dimensions: { width: Dimension; height: Dimension; depth: Dimension }
  facades: readonly CabinetFacadeDefinition[]
  defaultFacade: CabinetFacadeId
}

/** Illustrative MVP dimensions, not a manufacturer's production specification. */
export const CABINET_FAMILIES = {
  'base-storage': {
    id: 'base-storage',
    version: 1,
    purpose: 'Нижняя база',
    dimensions: {
      width: { min: 300, max: 1200, step: 10, preferred: [400, 450, 600, 800, 900] },
      height: { min: 700, max: 1000, step: 10, preferred: [820] },
      depth: { min: 450, max: 700, step: 10, preferred: [560, 600] },
    },
    facades: [
      { id: 'single-door', label: 'Одна дверца', minWidth: 300, maxWidth: 600 },
      { id: 'double-door', label: 'Две дверцы', minWidth: 600, maxWidth: 1200 },
      { id: 'three-drawers', label: 'Три ящика', minWidth: 400, maxWidth: 1200 },
    ],
    defaultFacade: 'single-door',
  },
  'wall-storage': {
    id: 'wall-storage',
    version: 1,
    purpose: 'Верхняя база',
    dimensions: {
      width: { min: 300, max: 1200, step: 10, preferred: [400, 600, 800] },
      height: { min: 400, max: 1000, step: 10, preferred: [700, 800] },
      depth: { min: 250, max: 450, step: 10, preferred: [320, 370] },
    },
    facades: [
      { id: 'single-door', label: 'Одна дверца', minWidth: 300, maxWidth: 600 },
      { id: 'double-door', label: 'Две дверцы', minWidth: 600, maxWidth: 1200 },
      { id: 'lift-up', label: 'Подъёмный фасад', minWidth: 400, maxWidth: 1200 },
    ],
    defaultFacade: 'single-door',
  },
  'tall-storage': {
    id: 'tall-storage',
    version: 1,
    purpose: 'Пенал для хранения',
    dimensions: {
      width: { min: 400, max: 900, step: 10, preferred: [400, 600, 800] },
      height: { min: 1800, max: 2400, step: 10, preferred: [2000, 2100, 2200] },
      depth: { min: 450, max: 700, step: 10, preferred: [560, 600] },
    },
    facades: [
      { id: 'stacked-doors', label: 'Две дверцы по высоте', minWidth: 400, maxWidth: 900 },
      { id: 'full-door', label: 'Одна высокая дверца', minWidth: 400, maxWidth: 600 },
    ],
    defaultFacade: 'stacked-doors',
  },
} as const satisfies Record<string, CabinetFamilyDefinition>

export type CabinetFamilyId = keyof typeof CABINET_FAMILIES

export function cabinetFacadeSpec(familyId: CabinetFamilyId, facade: CabinetFacadeId): CabinetFacadeDefinition | null {
  return (
    (CABINET_FAMILIES[familyId].facades as readonly CabinetFacadeDefinition[]).find((option) => option.id === facade) ??
    null
  )
}

export function cabinetFacadeAcceptsWidth(familyId: CabinetFamilyId, facade: CabinetFacadeId, width: number) {
  const definition = cabinetFacadeSpec(familyId, facade)
  return definition !== null && width >= definition.minWidth && width <= definition.maxWidth
}

/** Old sketch records without family metadata are interpreted using the new families, never a legacy renderer. */
export function cabinetModuleFor(item: {
  type: string
  elevation: number
  params: { width: number; height: number }
  cabinetModule?: CabinetModuleConfig
}): CabinetModuleConfig | null {
  if (item.type !== 'cabinet') return null
  return item.cabinetModule ?? cabinetModuleForNewBlock(item.type, item.elevation, item.params)
}

export function cabinetModuleForNewBlock(
  type: string,
  elevation: number,
  params: { width: number; height: number },
): CabinetModuleConfig | null {
  if (type !== 'cabinet') return null
  if (params.height >= 1500) return { familyId: 'tall-storage', version: 1, facade: 'stacked-doors' }
  if (elevation > 0)
    return { familyId: 'wall-storage', version: 1, facade: params.width > 600 ? 'double-door' : 'single-door' }
  return { familyId: 'base-storage', version: 1, facade: params.width > 600 ? 'double-door' : 'single-door' }
}
