import {
  BUILT_IN_FLANGE,
  type BlockParams,
  type BlockType,
  type CabinetModule,
  type HobConnection,
} from '@/domain/model'
import { CABINET_FAMILIES } from '@/domain/modules/cabinetFamilies'

/**
 * Пресет — стартовый экземпляр семейства поверх общей геометрии `cabinet`.
 * Напольный, навесной и пенал имеют разные размерные и фасадные правила.
 */
export type BlockPreset = {
  id: string
  label: string
  category: 'Корпусные' | 'Рабочая зона' | 'Техника'
  type: BlockType
  elevation: number
  params: BlockParams
  cabinetModule?: CabinetModule
  hobConnection?: HobConnection
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
    label: 'Нижняя база',
    category: 'Корпусные',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: WORKTOP_LEVEL, depth: 560, facadeColor: OAK },
    cabinetModule: { familyId: CABINET_FAMILIES['base-storage'].id, version: 1, facade: 'single-door' },
  },
  {
    id: 'wall-cabinet',
    label: 'Верхняя база',
    category: 'Корпусные',
    type: 'cabinet',
    elevation: 1400,
    params: { width: 600, height: 700, depth: 320, facadeColor: OAK },
    cabinetModule: { familyId: CABINET_FAMILIES['wall-storage'].id, version: 1, facade: 'single-door' },
  },
  {
    id: 'tall-cabinet',
    label: 'Пенал',
    category: 'Корпусные',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: 2100, depth: 560, facadeColor: OAK },
    cabinetModule: { familyId: CABINET_FAMILIES['tall-storage'].id, version: 1, facade: 'stacked-doors' },
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
    label: 'Кухонная плита',
    category: 'Техника',
    type: 'hob',
    elevation: flushWithWorktop(HOB_HEIGHT, BUILT_IN_FLANGE.hob),
    params: { width: 600, height: HOB_HEIGHT, depth: 520, facadeColor: GLASS },
    hobConnection: 'unknown',
  },
  {
    id: 'base-oven',
    label: 'База с духовкой',
    category: 'Техника',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: WORKTOP_LEVEL, depth: 560, facadeColor: OAK },
    cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'oven' },
  },
  {
    id: 'tall-oven',
    label: 'Пенал с духовкой',
    category: 'Техника',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: 2100, depth: 560, facadeColor: OAK },
    cabinetModule: { familyId: 'tall-storage', version: 1, facade: 'stacked-doors', role: 'oven' },
  },
  {
    id: 'dishwasher',
    label: 'Посудомойка',
    category: 'Техника',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: WORKTOP_LEVEL, depth: 560, facadeColor: OAK },
    cabinetModule: { familyId: 'base-storage', version: 1, facade: 'single-door', role: 'dishwasher' },
  },
  {
    id: 'freestanding-fridge',
    label: 'Холодильник отдельный',
    category: 'Техника',
    type: 'fridge',
    elevation: 0,
    params: { width: 600, height: 2000, depth: 650, facadeColor: '#e8e4dd' },
  },
  {
    id: 'built-in-fridge',
    label: 'Холодильник встроенный',
    category: 'Техника',
    type: 'cabinet',
    elevation: 0,
    params: { width: 600, height: 2100, depth: 560, facadeColor: OAK },
    cabinetModule: { familyId: 'tall-storage', version: 1, facade: 'full-door', role: 'fridge' },
  },
]

export const PRESET_CATEGORIES = ['Корпусные', 'Рабочая зона', 'Техника'] as const
