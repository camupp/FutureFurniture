import { describe, expect, it } from 'vitest'
import { visibleFurnitureLabelIds } from '../../../../src/modules/room-editor/furnitureLabels'
import { makeFurniture } from '../../../fixtures'

describe('visibleFurnitureLabelIds', () => {
  const left = makeFurniture('cabinet', {
    id: 'left',
    position: { x: 600, y: 330 },
    params: { ...makeFurniture().params, width: 1200 },
  })
  const right = makeFurniture('cabinet', {
    id: 'right',
    position: { x: 1800, y: 330 },
    params: { ...makeFurniture().params, width: 1200 },
  })
  const countertop = makeFurniture('countertop', {
    id: 'countertop',
    position: { x: 1200, y: 330 },
    elevation: 820,
  })

  it('keeps both cabinet labels and hides their shared countertop label', () => {
    expect(visibleFurnitureLabelIds([left, right, countertop])).toEqual(new Set(['left', 'right']))
  })

  it('gives a selected overlay priority over labels below it', () => {
    expect(visibleFurnitureLabelIds([left, right, countertop], 'countertop')).toEqual(new Set(['countertop']))
  })

  it('keeps labels of cabinets that only touch at their edges', () => {
    expect(visibleFurnitureLabelIds([left, right])).toEqual(new Set(['left', 'right']))
  })

  it('prefers a lower cabinet at the same plan position unless the upper one is selected', () => {
    const upper = { ...left, id: 'upper', elevation: 1400 }
    expect(visibleFurnitureLabelIds([left, upper])).toEqual(new Set(['left']))
    expect(visibleFurnitureLabelIds([left, upper], 'upper')).toEqual(new Set(['upper']))
  })
})
