import { describe, expect, it } from 'vitest'
import { cabinetFacePanels, fullCabinetFront } from '@/domain/assemblies/cabinetFaces'

const base = { familyId: 'base-storage', version: 1, facade: 'single-door' } as const
const wall = { familyId: 'wall-storage', version: 1, facade: 'single-door' } as const
const tall = { familyId: 'tall-storage', version: 1, facade: 'stacked-doors' } as const

describe('shared cabinet facade sections', () => {
  it('uses explicit door and drawer schemes for the base', () => {
    const front = fullCabinetFront(600)
    const one = cabinetFacePanels(600, 820, true, front, base)
    const two = cabinetFacePanels(600, 820, true, front, { ...base, facade: 'double-door' })
    const drawers = cabinetFacePanels(600, 820, true, front, { ...base, facade: 'three-drawers' })
    expect(one).toHaveLength(1)
    expect(two).toHaveLength(2)
    expect(drawers).toHaveLength(3)
    expect(drawers.every((panel) => panel.kind === 'drawer' && panel.handleOrientation === 'horizontal')).toBe(true)
    expect(drawers[0]?.bottom).toBe(103)
    expect(drawers[2]?.top).toBe(817)
    expect(drawers[1]!.bottom - drawers[0]!.top).toBeCloseTo(3)
  })

  it('restricts all panels to the visible part of a blind corner', () => {
    const open = { start: -40, end: 600 }
    const panels = cabinetFacePanels(1200, 820, true, [open], { ...base, facade: 'three-drawers' })
    expect(panels).toHaveLength(3)
    expect(panels.every((panel) => panel.left >= open.start && panel.right <= open.end)).toBe(true)
    expect(cabinetFacePanels(1200, 820, true, [], { ...base, facade: 'double-door' })).toEqual([])
  })

  it('places a single-door handle on the requested side and sizes a knob for both views', () => {
    const original = cabinetFacePanels(600, 820, true, undefined, base)[0]!
    const changed = cabinetFacePanels(600, 820, true, undefined, {
      ...base,
      handleStyle: 'knob',
      handleSide: 'left',
    })[0]!
    expect(original.handleX).toBeGreaterThan(0)
    expect(changed.handleX).toBeLessThan(0)
    expect(changed).toMatchObject({ handleStyle: 'knob', handleWidth: 32, handleHeight: 32 })
    expect(changed.left).toBe(original.left)
    expect(changed.right).toBe(original.right)
  })

  it('splits a tall cabinet vertically and keeps both handles around the seam', () => {
    const panels = cabinetFacePanels(600, 2100, true, undefined, tall)
    expect(panels).toHaveLength(2)
    expect(panels[0]?.top).toBeLessThan(panels[1]!.bottom)
    expect(panels[1]!.bottom - panels[0]!.top).toBe(3)
    expect(panels.map((panel) => panel.handleY)).toEqual([panels[0]!.top - 100, panels[1]!.bottom + 100])
    const single = cabinetFacePanels(600, 2100, true, undefined, { ...tall, facade: 'full-door' })
    expect(single).toHaveLength(1)
    expect(single[0]?.handleY).toBe(1100)
  })

  it('gives a wall lift-up facade one horizontal handle near its bottom', () => {
    const panels = cabinetFacePanels(800, 700, false, undefined, { ...wall, facade: 'lift-up' })
    expect(panels).toHaveLength(1)
    expect(panels[0]).toMatchObject({ kind: 'lift', bottom: 3, top: 697, handleY: 73, handleOrientation: 'horizontal' })
  })

  it('uses appliance fronts instead of ordinary cabinet doors and drawers', () => {
    expect(cabinetFacePanels(600, 820, true, undefined, { ...base, role: 'oven' }).map((panel) => panel.kind)).toEqual([
      'oven',
    ])
    expect(
      cabinetFacePanels(600, 820, true, undefined, { ...base, role: 'dishwasher' }).map((panel) => panel.kind),
    ).toEqual(['dishwasher'])
    expect(cabinetFacePanels(600, 2100, true, undefined, { ...tall, role: 'oven' }).map((panel) => panel.kind)).toEqual(
      ['door', 'oven', 'door'],
    )
    expect(
      cabinetFacePanels(600, 2100, true, undefined, { ...tall, facade: 'full-door', role: 'fridge' }).map(
        (panel) => panel.kind,
      ),
    ).toEqual(['fridge', 'fridge'])
  })
})
