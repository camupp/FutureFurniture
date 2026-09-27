import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/application/project'
import { normalizeProjectDocument, partializeProject } from '@/application/project/persistence'
import { CABINET_FAMILIES, cabinetFacadeAcceptsWidth } from '@/domain/modules/cabinetFamilies'
import { BLOCK_PRESETS } from '@/features/furniture-library/catalog'
import { makeRoom } from '../fixtures'

const state = useAppStore.getState
const basePreset = BLOCK_PRESETS.find((preset) => preset.id === 'base-cabinet')!

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom({ walls: [] }), furniture: [] }, true)
})

describe('versioned cabinet families', () => {
  it('creates configured cabinets for every catalog preset', () => {
    state().addBlock(basePreset)
    expect(state().furniture[0]?.cabinetModule).toEqual({
      familyId: CABINET_FAMILIES['base-storage'].id,
      version: 1,
      facade: 'single-door',
    })
    state().addBlock(BLOCK_PRESETS.find((preset) => preset.id === 'wall-cabinet')!)
    state().addBlock(BLOCK_PRESETS.find((preset) => preset.id === 'tall-cabinet')!)
    expect(state().furniture.map((item) => item.cabinetModule?.familyId)).toEqual([
      'base-storage',
      'wall-storage',
      'tall-storage',
    ])
    expect(state().furniture[2]?.cabinetModule?.facade).toBe('stacked-doors')
  })

  it('enforces the selected facade width range and keeps the facade change undoable', () => {
    state().addBlock(basePreset)
    const id = state().furniture[0]!.id
    state().updateFurnitureParams(id, { width: 1000, height: 1200, depth: 300 })
    expect(state().furniture[0]?.params).toMatchObject({ width: 600, height: 1000, depth: 450 })
    state().setCabinetFacade(id, 'three-drawers')
    state().updateFurnitureParams(id, { width: 900 })
    expect(state().furniture[0]?.params.width).toBe(900)
    state().updateFurnitureParams(id, { depth: 455 })
    expect(state().furniture[0]?.params.depth).toBe(460)
    state().setCabinetFacade(id, 'single-door')
    expect(state().furniture[0]?.cabinetModule?.facade).toBe('three-drawers')
    state().undo()
    expect(state().furniture[0]?.params.depth).toBe(450)
    state().undo()
    expect(state().furniture[0]?.params.width).toBe(600)
    state().undo()
    expect(state().furniture[0]?.cabinetModule?.facade).toBe('single-door')
    expect(cabinetFacadeAcceptsWidth('base-storage', 'double-door', 600)).toBe(true)
  })

  it('round-trips the configuration and accepts projects saved before the family existed', () => {
    state().addBlock(basePreset)
    const id = state().furniture[0]!.id
    state().setCabinetFacade(id, 'three-drawers')
    const saved = JSON.parse(JSON.stringify(partializeProject(state())))
    const loaded = normalizeProjectDocument(saved, state(), () => crypto.randomUUID())
    expect(loaded?.furniture[0]?.cabinetModule?.facade).toBe('three-drawers')

    saved.furniture[0].cabinetModule = undefined
    const legacy = normalizeProjectDocument(saved, state(), () => crypto.randomUUID())
    expect(legacy?.furniture[0]?.cabinetModule).toEqual({ familyId: 'base-storage', version: 1, facade: 'single-door' })
    expect(legacy?.furniture[0]?.params).toEqual(state().furniture[0]?.params)
  })

  it('limits facade choices to the selected family and keeps tall dimensions separate from base dimensions', () => {
    state().addBlock(BLOCK_PRESETS.find((preset) => preset.id === 'tall-cabinet')!)
    const id = state().furniture[0]!.id
    state().setCabinetFacade(id, 'three-drawers')
    expect(state().furniture[0]?.cabinetModule?.facade).toBe('stacked-doors')
    state().setCabinetFacade(id, 'full-door')
    expect(state().furniture[0]?.cabinetModule?.facade).toBe('full-door')
    state().updateFurnitureParams(id, { height: 1500, depth: 300 })
    expect(state().furniture[0]?.params).toMatchObject({ height: 1800, depth: 450 })
  })

  it('round-trips the tall and wall facade choices through the project document', () => {
    state().addBlock(BLOCK_PRESETS.find((preset) => preset.id === 'tall-cabinet')!)
    state().addBlock(BLOCK_PRESETS.find((preset) => preset.id === 'wall-cabinet')!)
    const [tall, wall] = state().furniture
    state().setCabinetFacade(tall!.id, 'full-door')
    state().setCabinetFacade(wall!.id, 'lift-up')
    const saved = JSON.parse(JSON.stringify(partializeProject(state())))
    const restored = normalizeProjectDocument(saved, state(), () => crypto.randomUUID())
    expect(restored?.furniture.map((item) => item.cabinetModule?.facade)).toEqual(['full-door', 'lift-up'])
  })

  it('saves handle choices and restores them through undo and redo', () => {
    state().addBlock(basePreset)
    const id = state().furniture[0]!.id
    state().updateCabinetHardware(id, { handleStyle: 'knob', handleSide: 'left' })
    expect(state().furniture[0]?.cabinetModule).toMatchObject({ handleStyle: 'knob', handleSide: 'left' })
    const saved = JSON.parse(JSON.stringify(partializeProject(state())))
    expect(
      normalizeProjectDocument(saved, state(), () => crypto.randomUUID())?.furniture[0]?.cabinetModule,
    ).toMatchObject({
      handleStyle: 'knob',
      handleSide: 'left',
    })
    state().undo()
    expect(state().furniture[0]?.cabinetModule?.handleStyle).toBeUndefined()
    state().redo()
    expect(state().furniture[0]?.cabinetModule?.handleSide).toBe('left')
  })
})
