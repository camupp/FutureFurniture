import { z } from 'zod'
import { pointSchema } from './point'

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
  /** Число физических гнёзд. Старые отметки питания считаются двойными. */
  socketCount: z.union([z.literal(1), z.literal(2)]).optional(),
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
