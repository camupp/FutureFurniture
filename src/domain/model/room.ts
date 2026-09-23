import { z } from 'zod'
import { wallSchema, WALL_LIMITS } from './wall'
import { openingSchema } from './opening'
import { utilitySchema } from './utility'

export const roomSchema = z.object({
  walls: z.array(wallSchema),
  wallHeight: z.number().min(WALL_LIMITS.height.min).max(WALL_LIMITS.height.max),
  openings: z.array(openingSchema).default([]),
  utilities: z.array(utilitySchema).default([]),
})
export type Room = z.infer<typeof roomSchema>
