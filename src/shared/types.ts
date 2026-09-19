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

export const CABINET_LIMITS = {
  width: { min: 300, max: 1200, step: 10 },
  height: { min: 300, max: 2200, step: 10 },
  depth: { min: 300, max: 700, step: 10 },
} as const

export const FACADE_COLORS = [
  { value: '#e8e4dd', label: 'Белый' },
  { value: '#d3bb98', label: 'Дуб' },
  { value: '#8d6e52', label: 'Орех' },
  { value: '#5b6b63', label: 'Олива' },
  { value: '#3f4854', label: 'Графит' },
] as const

export const cabinetParamsSchema = z.object({
  width: z.number().min(CABINET_LIMITS.width.min).max(CABINET_LIMITS.width.max),
  height: z.number().min(CABINET_LIMITS.height.min).max(CABINET_LIMITS.height.max),
  depth: z.number().min(CABINET_LIMITS.depth.min).max(CABINET_LIMITS.depth.max),
  facadeColor: z.string(),
})
export type CabinetParams = z.infer<typeof cabinetParamsSchema>

export const ELEVATION_LIMITS = { min: 0, max: 2500, step: 10 } as const

export const furnitureItemSchema = z.object({
  id: z.string(),
  type: z.literal('cabinet'),
  /** Центр блока на плане. */
  position: pointSchema,
  /** Низ блока над полом: 0 — напольный, 1400 — навесной. */
  elevation: z.number().min(ELEVATION_LIMITS.min).max(ELEVATION_LIMITS.max).default(0),
  /** Градусы по часовой стрелке на плане. 0 — фасад смотрит в сторону +y. */
  rotation: z.number(),
  params: cabinetParamsSchema,
})
export type FurnitureItem = z.infer<typeof furnitureItemSchema>

export const projectSchema = z.object({
  room: roomSchema,
  furniture: z.array(furnitureItemSchema),
})
export type Project = z.infer<typeof projectSchema>

export const DEFAULT_CABINET: CabinetParams = {
  width: 600,
  height: 850,
  depth: 560,
  facadeColor: FACADE_COLORS[1].value,
}
