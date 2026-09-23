import { z } from 'zod'
import { pointSchema } from './point'

export const WALL_LIMITS = {
  thickness: { min: 50, max: 500, step: 10 },
  height: { min: 2000, max: 4000, step: 10 },
} as const

export const wallSchema = z.object({
  id: z.string(),
  /** Внешний контур образует пол; перегородки не меняют его геометрию. */
  kind: z.enum(['boundary', 'partition']).optional(),
  start: pointSchema,
  end: pointSchema,
  thickness: z.number().min(WALL_LIMITS.thickness.min).max(WALL_LIMITS.thickness.max),
})
export type Wall = z.infer<typeof wallSchema>
