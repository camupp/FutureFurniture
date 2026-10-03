import { z } from 'zod'
import { wallSchema, WALL_LIMITS } from './wall'
import { openingSchema } from './opening'
import { utilitySchema } from './utility'

/** Эскизная досягаемость кабеля, не норматив и не подтверждение подключения. */
export const POWER_REACH_DEFAULT = 1000
export const POWER_REACH_LIMITS = { min: 300, max: 2000, step: 100 } as const

export const roomSchema = z.object({
  walls: z.array(wallSchema),
  wallHeight: z.number().min(WALL_LIMITS.height.min).max(WALL_LIMITS.height.max),
  powerReachMm: z.number().min(POWER_REACH_LIMITS.min).max(POWER_REACH_LIMITS.max).optional(),
  openings: z.array(openingSchema).default([]),
  utilities: z.array(utilitySchema).default([]),
})
export type Room = z.infer<typeof roomSchema>
