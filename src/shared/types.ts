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

export const roomSchema = z.object({
  walls: z.array(wallSchema),
  wallHeight: z.number().min(WALL_LIMITS.height.min).max(WALL_LIMITS.height.max),
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
})
export type FurnitureItem = z.infer<typeof furnitureItemSchema>

export const projectSchema = z.object({
  room: roomSchema,
  furniture: z.array(furnitureItemSchema),
})
export type Project = z.infer<typeof projectSchema>
