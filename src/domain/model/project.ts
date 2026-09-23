import { z } from 'zod'
import { roomSchema } from './room'
import { furnitureItemSchema } from './furniture'

export const projectSchema = z.object({
  room: roomSchema,
  furniture: z.array(furnitureItemSchema),
})
export type Project = z.infer<typeof projectSchema>
