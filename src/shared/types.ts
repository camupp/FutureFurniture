import { z } from 'zod'

/** Все линейные размеры в миллиметрах. План — вид сверху: x вправо, y вниз. */

export const pointSchema = z.object({ x: z.number(), y: z.number() })
export type Point = z.infer<typeof pointSchema>

export const WALL_LIMITS = {
  thickness: { min: 50, max: 500, step: 10 },
  height: { min: 2000, max: 4000, step: 10 },
} as const

export const wallSchema = z.object({
  id: z.string(),
  start: pointSchema,
  end: pointSchema,
  thickness: z.number().min(WALL_LIMITS.thickness.min).max(WALL_LIMITS.thickness.max),
})
export type Wall = z.infer<typeof wallSchema>

export const OPENING_TYPES = ['window', 'door'] as const
export type OpeningType = (typeof OPENING_TYPES)[number]

export const OPENING_LABELS: Record<OpeningType, string> = {
  window: 'Окно',
  door: 'Дверь',
}

export const OPENING_LIMITS = {
  width: { min: 300, max: 4000, step: 10 },
  height: { min: 300, max: 3000, step: 10 },
  sill: { min: 0, max: 2000, step: 10 },
} as const

export const OPENING_DEFAULTS: Record<OpeningType, { width: number; height: number; sill: number }> = {
  window: { width: 1200, height: 1400, sill: 900 },
  door: { width: 800, height: 2100, sill: 0 },
}

/**
 * Проём живёт внутри стены: положение задаётся расстоянием от её начала до центра.
 * Планировщики хранят его долей длины стены, но у нас инструмент замера — «окно
 * в 800 мм от угла» должно остаться на своём расстоянии, даже если стену удлинили.
 */
export const openingSchema = z.object({
  id: z.string(),
  wallId: z.string(),
  type: z.enum(OPENING_TYPES),
  /** Расстояние от начала стены до центра проёма. */
  offset: z.number(),
  width: z.number().min(OPENING_LIMITS.width.min).max(OPENING_LIMITS.width.max),
  height: z.number().min(OPENING_LIMITS.height.min).max(OPENING_LIMITS.height.max),
  /** Высота от пола до низа проёма: у двери 0, у окна — подоконник. */
  sill: z.number().min(OPENING_LIMITS.sill.min).max(OPENING_LIMITS.sill.max),
  /** Сторона петель, если смотреть из помещения. Влияет только на дугу открывания. */
  hinge: z.enum(['left', 'right']).default('left'),
})
export type Opening = z.infer<typeof openingSchema>

export const UTILITY_TYPES = ['water', 'sewer', 'gas', 'vent', 'power'] as const
export type UtilityType = (typeof UTILITY_TYPES)[number]

export const UTILITY_LABELS: Record<UtilityType, string> = {
  water: 'Вода',
  sewer: 'Канализация',
  gas: 'Газ',
  vent: 'Вентиляция',
  power: 'Розетка',
}

export const UTILITY_COLORS: Record<UtilityType, string> = {
  water: '#0ea5e9',
  sewer: '#7c3aed',
  gas: '#f59e0b',
  vent: '#10b981',
  power: '#ef4444',
}

export const UTILITY_DEFAULT_HEIGHT: Record<UtilityType, number> = {
  water: 500,
  sewer: 300,
  gas: 900,
  vent: 2200,
  power: 1100,
}

export const utilityMountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('floor') }),
  z.object({
    kind: z.literal('wall'),
    wallId: z.string(),
    /** Расстояние от начала стены до центра вывода. */
    offset: z.number(),
  }),
])
export type UtilityMount = z.infer<typeof utilityMountSchema>

export const utilitySchema = z.object({
  id: z.string(),
  type: z.enum(UTILITY_TYPES),
  /**
   * Резервная мировая координата и координата напольного вывода. Для настенного
   * вывода фактическое положение вычисляется из стены, чтобы он следовал за ней.
   */
  point: pointSchema,
  mount: utilityMountSchema.default({ kind: 'floor' }),
  /** Высота вывода от пола. */
  height: z.number().min(0).max(4000),
})
export type Utility = z.infer<typeof utilitySchema>

export const roomSchema = z.object({
  walls: z.array(wallSchema),
  wallHeight: z.number().min(WALL_LIMITS.height.min).max(WALL_LIMITS.height.max),
  openings: z.array(openingSchema).default([]),
  utilities: z.array(utilitySchema).default([]),
})
export type Room = z.infer<typeof roomSchema>

export const BLOCK_TYPES = ['cabinet', 'countertop', 'sink', 'hob'] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

export const BLOCK_LABELS: Record<BlockType, string> = {
  cabinet: 'Шкаф',
  countertop: 'Столешница',
  sink: 'Мойка',
  hob: 'Плита',
}

/** Встраиваемые блоки не участвуют в проверке пересечений: мойка живёт в тумбе, плита — в столешнице. */
export const BUILT_IN_TYPES: BlockType[] = ['sink', 'hob']

/**
 * Толщина опорной части врезного блока: бортик мойки, стеклянная плита варочной панели.
 * Только она остаётся над столешницей, остальное уходит в вырез.
 */
export const BUILT_IN_FLANGE: Record<BlockType, number> = {
  cabinet: 0,
  countertop: 0,
  sink: 12,
  hob: 10,
}

export type Limit = { min: number; max: number; step: number }

/**
 * Границы габаритов по типу блока. Используются и в полях ввода, и при ограничении
 * значений в сторе. Zod-схема намеренно шире: её задача — отсеять мусор из хранилища.
 */
export const BLOCK_LIMITS: Record<BlockType, { width: Limit; height: Limit; depth: Limit }> = {
  cabinet: {
    width: { min: 300, max: 1200, step: 10 },
    height: { min: 300, max: 2400, step: 10 },
    depth: { min: 300, max: 700, step: 10 },
  },
  countertop: {
    width: { min: 300, max: 4000, step: 10 },
    height: { min: 20, max: 80, step: 1 },
    depth: { min: 400, max: 900, step: 10 },
  },
  sink: {
    width: { min: 400, max: 1000, step: 10 },
    height: { min: 120, max: 300, step: 10 },
    depth: { min: 400, max: 600, step: 10 },
  },
  hob: {
    width: { min: 300, max: 900, step: 10 },
    height: { min: 30, max: 120, step: 5 },
    depth: { min: 400, max: 600, step: 10 },
  },
}

export const ELEVATION_LIMITS = { min: 0, max: 2500, step: 10 } as const

export const FACADE_COLORS = [
  { value: '#e8e4dd', label: 'Белый' },
  { value: '#d3bb98', label: 'Дуб' },
  { value: '#8d6e52', label: 'Орех' },
  { value: '#5b6b63', label: 'Олива' },
  { value: '#3f4854', label: 'Графит' },
] as const

export const blockParamsSchema = z.object({
  width: z.number().min(10).max(6000),
  height: z.number().min(10).max(3000),
  depth: z.number().min(10).max(1200),
  facadeColor: z.string(),
})
export type BlockParams = z.infer<typeof blockParamsSchema>

export const WALL_SIDES = ['left', 'right'] as const
export type WallSide = (typeof WALL_SIDES)[number]

/**
 * Положение пристенного блока в локальной системе стены.
 * `offset` измеряется от начала стены до центра блока, `distance` — зазор между
 * внутренней поверхностью стены и задней гранью мебели.
 */
export const wallAnchorSchema = z.object({
  wallId: z.string(),
  side: z.enum(WALL_SIDES),
  offset: z.number(),
  distance: z.number().min(0).default(0),
})
export type WallAnchor = z.infer<typeof wallAnchorSchema>

/** Автоматическая столешница пересчитывается по её несущим тумбам. */
export const autoCountertopSchema = z.object({
  supportIds: z.array(z.string()).min(1),
  frontOverhang: z.number().min(0).max(100).default(40),
})

export const furnitureItemSchema = z.object({
  id: z.string(),
  /** Тип определяет геометрию внутри габаритного ящика. */
  type: z.enum(BLOCK_TYPES).default('cabinet'),
  /** Центр блока на плане. */
  position: pointSchema,
  /** Низ блока над полом: 0 — напольный, 1400 — навесной. */
  elevation: z.number().min(ELEVATION_LIMITS.min).max(ELEVATION_LIMITS.max).default(0),
  /** Градусы по часовой стрелке на плане. 0 — фасад смотрит в сторону +y. */
  rotation: z.number(),
  params: blockParamsSchema,
  /** Заполняется только у мебели, которую пользователь прикрепил к стене. */
  wallAnchor: wallAnchorSchema.optional(),
  autoCountertop: autoCountertopSchema.optional(),
})
export type FurnitureItem = z.infer<typeof furnitureItemSchema>

export const projectSchema = z.object({
  room: roomSchema,
  furniture: z.array(furnitureItemSchema),
})
export type Project = z.infer<typeof projectSchema>
