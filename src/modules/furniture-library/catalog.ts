import { BUILT_IN_FLANGE, type BlockParams, type BlockType } from '../../shared/types'

/**
 * Пресет — это набор дефолтов поверх одной из геометрий. Навесной шкаф и пенал —
 * тот же `cabinet`, отличаются габаритами и высотой установки.
 */
export type BlockPreset = {
  id: string
  label: string
  category: 'Корпусные' | 'Рабочая зона'
  type: BlockType
  elevation: number
  params: BlockParams
}

const OAK = '#d3bb98'
const STONE = '#8f9299'
const STEEL = '#b6bbc2'
const GLASS = '#2b2f36'

/** Стандартная кухонная отметка: цоколь 100 + корпус 720. */
export const WORKTOP_LEVEL = 820
const WORKTOP_THICKNESS = 38
/** Верх рабочей поверхности — от него отсчитывается врезная техника. */
export const WORKTOP_TOP = WORKTOP_LEVEL + WORKTOP_THICKNESS

const SINK_HEIGHT = 180
const HOB_HEIGHT = 50

/**
 * Врезной блок опирается на столешницу своим бортиком: над поверхностью остаётся
 * только он, остальное уходит в вырез.
 */
const flushWithWorktop = (height: number, flange: number) => WORKTOP_TOP - (height - flange)

export const BLOCK_PRESETS: BlockPreset[] = [
  {
    id: 'base-cabinet',
    label: 'Шкаф напольный',
    category: 'Корпусные',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: WORKTOP_LEVEL, depth: 560, facadeColor: OAK },
  },
  {
    id: 'wall-cabinet',
    label: 'Шкаф навесной',
    category: 'Корпусные',
    type: 'cabinet',
    elevation: 1400,
    params: { width: 600, height: 700, depth: 320, facadeColor: OAK },
  },
  {
    id: 'tall-cabinet',
    label: 'Пенал',
    category: 'Корпусные',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: 2100, depth: 560, facadeColor: OAK },
  },
  {
    id: 'countertop',
    label: 'Столешница',
    category: 'Рабочая зона',
    type: 'countertop',
    elevation: WORKTOP_LEVEL,
    params: { width: 2400, height: WORKTOP_THICKNESS, depth: 600, facadeColor: STONE },
  },
  {
    id: 'sink',
    label: 'Мойка',
    category: 'Рабочая зона',
    type: 'sink',
    elevation: flushWithWorktop(SINK_HEIGHT, BUILT_IN_FLANGE.sink),
    params: { width: 600, height: SINK_HEIGHT, depth: 500, facadeColor: STEEL },
  },
  {
    id: 'hob',
    label: 'Плита',
    category: 'Рабочая зона',
    type: 'hob',
    elevation: flushWithWorktop(HOB_HEIGHT, BUILT_IN_FLANGE.hob),
    params: { width: 600, height: HOB_HEIGHT, depth: 520, facadeColor: GLASS },
  },
]

export const PRESET_CATEGORIES = ['Корпусные', 'Рабочая зона'] as const
