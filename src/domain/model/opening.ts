import { z } from 'zod'

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
