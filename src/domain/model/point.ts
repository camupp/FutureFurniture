import { z } from 'zod'

/** Все линейные размеры в миллиметрах. План — вид сверху: x вправо, y вниз. */

export const pointSchema = z.object({ x: z.number(), y: z.number() })
export type Point = z.infer<typeof pointSchema>
