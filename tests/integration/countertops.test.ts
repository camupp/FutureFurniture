import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/application/project'
import type { FurnitureItem, Room } from '@/domain/model'
import { cabinetFrontLayout } from '@/domain/assemblies/cabinetJoints'
import { furnitureFromWallAnchor } from '@/domain/placement/wallAnchors'
import { makeFurniture, makeRoom } from '../fixtures'

function resetStore() {
  localStorage.clear()
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [], selection: null }, true)
}

function base(id: string, offset: number, wallId = 'top', room: Room = makeRoom()): FurnitureItem {
  const wall = room.walls.find((candidate) => candidate.id === wallId)!
  return furnitureFromWallAnchor(
    makeFurniture('cabinet', {
      id,
      wallAnchor: { wallId, side: 'left', offset, distance: 0 },
    }),
    wall,
  )
}

function item(id: string): FurnitureItem {
  return useAppStore.getState().furniture.find((candidate) => candidate.id === id)!
}

function countertops(): FurnitureItem[] {
  return useAppStore.getState().furniture.filter((candidate) => candidate.type === 'countertop')
}

function setLongRow() {
  const room = makeRoom({
    walls: [
      { id: 'top', start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, thickness: 100 },
      { id: 'right', start: { x: 6000, y: 0 }, end: { x: 6000, y: 3000 }, thickness: 100 },
      { id: 'bottom', start: { x: 6000, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 100 },
      { id: 'left', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 100 },
    ],
  })
  const furniture = [650, 1850, 3050, 4250].map((offset, index) => {
    const cabinet = base(`base-${index}`, offset, 'top', room)
    return { ...cabinet, params: { ...cabinet.params, width: 1200 } }
  })
  useAppStore.setState({ room, furniture })
  useAppStore.getState().addCountertopForRow('base-0')
}

function withoutAutomation(countertop: FurnitureItem): FurnitureItem {
  const { autoCountertop: _removed, ...manual } = countertop
  return manual
}

beforeEach(resetStore)

describe('automatic countertop actions', () => {
  it('recognizes the blind corner produced by wall collision displacement', () => {
    const room = makeRoom()
    const topWall = room.walls.find((wall) => wall.id === 'top')!
    const rightWall = room.walls.find((wall) => wall.id === 'right')!
    const first = furnitureFromWallAnchor(
      makeFurniture('cabinet', {
        id: 'first',
        params: { ...makeFurniture().params, width: 1200 },
        wallAnchor: { wallId: 'top', side: 'left', offset: 2950, distance: 0 },
      }),
      topWall,
    )
    const second = furnitureFromWallAnchor(
      makeFurniture('cabinet', {
        id: 'second',
        wallAnchor: { wallId: 'right', side: 'left', offset: 400, distance: 0 },
      }),
      rightWall,
    )
    useAppStore.setState({ room, furniture: [first, second] })

    useAppStore.getState().dropFurniture('second', { x: 3500, y: 400 })

    expect(item('second')).toMatchObject({ position: { x: 3270, y: 910 }, rotation: 90 })
    expect(cabinetFrontLayout(item('first'), useAppStore.getState().furniture).blocked).toEqual([
      { start: 40, end: 600 },
    ])
  })

  it('manages a free-standing blind corner as one L-shaped countertop and restores it after separation', () => {
    const first = makeFurniture('cabinet', {
      id: 'first',
      position: { x: 600, y: 280 },
      params: { ...makeFurniture().params, width: 1200 },
    })
    const second = makeFurniture('cabinet', {
      id: 'second',
      position: { x: 920, y: 860 },
      rotation: 90,
    })
    useAppStore.setState({ room: makeRoom({ walls: [] }), furniture: [first, second] })

    useAppStore.getState().addCountertopForRow('first')

    const cornerTops = countertops()
    expect(cornerTops).toHaveLength(2)
    expect(new Set(cornerTops.map((countertop) => countertop.autoCountertop?.groupId))).toEqual(
      new Set([cornerTops[0]!.autoCountertop!.groupId]),
    )
    expect(cornerTops[0]!.autoCountertop!.groupId).toBeTruthy()
    expect(cabinetFrontLayout(item('first'), useAppStore.getState().furniture).blocked).toHaveLength(1)

    useAppStore.getState().updateFurnitureParams(cornerTops[0]!.id, { facadeColor: '#ffffff', height: 50 })
    expect(countertops().every((countertop) => countertop.params.facadeColor === '#ffffff')).toBe(true)
    expect(countertops().every((countertop) => countertop.params.height === 50)).toBe(true)

    useAppStore.getState().moveFurniture('second', { x: 920, y: 900 })
    expect(cabinetFrontLayout(item('first'), useAppStore.getState().furniture).blocked).toEqual([])
    expect(countertops()).toHaveLength(2)
    expect(countertops().every((countertop) => countertop.autoCountertop?.groupId === undefined)).toBe(true)

    useAppStore.getState().moveFurniture('second', { x: 920, y: 860 })
    expect(countertops().every((countertop) => countertop.autoCountertop?.groupId)).toBe(true)
    useAppStore.getState().detachCountertop(countertops()[0]!.id)
    expect(countertops().every((countertop) => countertop.autoCountertop === undefined)).toBe(true)
  })

  it('covers a complete row and selects its existing countertop when requested again', () => {
    useAppStore.setState({ furniture: [base('first', 1000), base('second', 1600)] })

    useAppStore.getState().addCountertopForRow('first')

    expect(countertops()).toHaveLength(1)
    const countertop = countertops()[0]!
    expect(countertop).toMatchObject({
      elevation: 820,
      position: { x: 1300, y: 350 },
      params: { width: 1200, height: 38, depth: 600 },
      autoCountertop: { supportIds: ['first', 'second'], frontOverhang: 40 },
    })
    expect(useAppStore.getState().selection).toEqual({ kind: 'furniture', id: countertop.id })

    useAppStore.getState().select({ kind: 'furniture', id: 'second' })
    useAppStore.getState().addCountertopForRow('second')

    expect(countertops()).toHaveLength(1)
    expect(useAppStore.getState().selection).toEqual({ kind: 'furniture', id: countertop.id })
  })

  it('updates length, depth and elevation after support dimensions change', () => {
    useAppStore.setState({ furniture: [base('base', 1200)] })
    useAppStore.getState().addCountertopForRow('base')
    const countertopId = countertops()[0]!.id

    useAppStore.getState().updateFurnitureParams('base', { width: 1200, depth: 650, height: 900 })

    expect(item('base')).toMatchObject({ position: { x: 1200, y: 375 }, elevation: 0 })
    expect(item(countertopId)).toMatchObject({
      position: { x: 1200, y: 395 },
      elevation: 900,
      params: { width: 1200, depth: 690, height: 38 },
    })
  })

  it('keeps a resized support in its row instead of colliding with its own countertop', () => {
    useAppStore.setState({ furniture: [base('first', 1000), base('second', 1600)] })
    useAppStore.getState().addCountertopForRow('first')

    useAppStore.getState().updateFurnitureParams('second', { width: 1200 })

    expect(item('second')).toMatchObject({
      position: { x: 1900, y: 330 },
      elevation: 0,
      wallAnchor: { offset: 1900 },
    })
    expect(countertops()).toHaveLength(1)
    expect(countertops()[0]).toMatchObject({
      params: { width: 1800 },
      autoCountertop: { supportIds: ['first', 'second'] },
    })
  })

  it('moves a support and its countertop without lifting the support onto its own top', () => {
    useAppStore.setState({ furniture: [base('base', 1000)] })
    useAppStore.getState().addCountertopForRow('base')
    const countertopId = countertops()[0]!.id

    useAppStore.getState().dropFurniture('base', { x: 1100, y: 200 })

    expect(item('base')).toMatchObject({ position: { x: 1100, y: 330 }, elevation: 0 })
    expect(item(countertopId)).toMatchObject({ position: { x: 1100, y: 350 }, elevation: 820 })
  })

  it('splits at a removed middle cabinet and removes the top when its last support disappears', () => {
    useAppStore.setState({ furniture: [base('first', 1000), base('middle', 1600), base('last', 2200)] })
    useAppStore.getState().addCountertopForRow('middle')

    useAppStore.getState().removeFurniture('middle')

    expect(countertops()).toHaveLength(2)
    expect(countertops()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ params: expect.objectContaining({ width: 600 }), position: { x: 1000, y: 350 } }),
        expect.objectContaining({ params: expect.objectContaining({ width: 600 }), position: { x: 2200, y: 350 } }),
      ]),
    )
    expect(
      countertops()
        .flatMap((countertop) => countertop.autoCountertop!.supportIds)
        .sort(),
    ).toEqual(['first', 'last'])

    useAppStore.getState().removeFurniture('first')
    useAppStore.getState().removeFurniture('last')

    expect(useAppStore.getState().furniture).toEqual([])
    expect(useAppStore.getState().selection).toBeNull()
  })

  it('extends an existing countertop when a newly added cabinet joins its row', () => {
    useAppStore.setState({ furniture: [base('first', 1000)] })
    useAppStore.getState().addCountertopForRow('first')
    const countertopId = countertops()[0]!.id

    useAppStore.getState().addBlock({ type: 'cabinet', elevation: 0, params: makeFurniture().params })
    const addedId = useAppStore.getState().selection!.id
    useAppStore.getState().dropFurniture(addedId, { x: 1600, y: 200 })

    expect(countertops()).toHaveLength(1)
    expect(item(countertopId)).toMatchObject({
      position: { x: 1300, y: 350 },
      params: { width: 1200 },
      autoCountertop: { supportIds: ['first', addedId] },
    })
  })

  it('freezes a detached countertop and permits independent edits', () => {
    useAppStore.setState({ furniture: [base('base', 1000)] })
    useAppStore.getState().addCountertopForRow('base')
    const countertopId = countertops()[0]!.id
    const original = item(countertopId)

    useAppStore.getState().detachCountertop(countertopId)
    useAppStore.getState().updateFurnitureParams('base', { width: 1000, depth: 650, height: 900 })

    expect(item(countertopId).autoCountertop).toBeUndefined()
    expect(item(countertopId).params).toEqual(original.params)
    expect(item(countertopId).position).toEqual(original.position)
    expect(item(countertopId).elevation).toBe(original.elevation)

    useAppStore.getState().updateFurnitureParams(countertopId, { width: 1400, depth: 700 })
    useAppStore.getState().moveFurniture(countertopId, { x: 2000, y: 1800 })
    useAppStore.getState().removeFurniture('base')

    expect(countertops()).toHaveLength(1)
    expect(item(countertopId)).toMatchObject({ params: { width: 1400, depth: 700 }, position: { x: 2000, y: 1800 } })
  })

  it('protects derived dimensions and position while allowing thickness and finish changes', () => {
    useAppStore.setState({ furniture: [base('base', 1000)] })
    useAppStore.getState().addCountertopForRow('base')
    const countertopId = countertops()[0]!.id

    useAppStore.getState().updateFurnitureParams(countertopId, {
      width: 3000,
      depth: 850,
      height: 50,
      facadeColor: '#ffffff',
    })
    useAppStore.getState().moveFurniture(countertopId, { x: 2200, y: 1800 })
    useAppStore.getState().rotateFurniture(countertopId, 90)
    useAppStore.getState().elevateFurniture(countertopId, 1500)

    expect(item(countertopId)).toMatchObject({
      position: { x: 1000, y: 350 },
      rotation: 0,
      elevation: 820,
      params: { width: 600, depth: 600, height: 50, facadeColor: '#ffffff' },
    })
  })

  it('follows its supports when the wall moves or changes thickness', () => {
    useAppStore.setState({ furniture: [base('base', 1000, 'right')] })
    useAppStore.getState().addCountertopForRow('base')
    const countertopId = countertops()[0]!.id

    useAppStore.getState().updateWallLength('top', 4000)
    useAppStore.getState().updateWallThickness('right', 200)

    expect(item('base')).toMatchObject({ position: { x: 3620, y: 1000 }, rotation: 90 })
    expect(item(countertopId)).toMatchObject({
      position: { x: 3600, y: 1000 },
      rotation: 90,
      wallAnchor: { wallId: 'right', offset: 1000 },
      autoCountertop: { supportIds: ['base'] },
    })
  })

  it('keeps its generated countertop when wall deletion leaves a valid free-standing support', () => {
    useAppStore.setState({ furniture: [base('base', 1000)] })
    useAppStore.getState().addCountertopForRow('base')

    useAppStore.getState().removeWall('top')

    expect(countertops()).toHaveLength(1)
    expect(countertops()[0]).toMatchObject({
      position: { x: 1000, y: 350 },
      autoCountertop: { supportIds: ['base'] },
    })
    expect(item('base').wallAnchor).toBeUndefined()
    expect(useAppStore.getState().selection).toEqual({ kind: 'furniture', id: countertops()[0]!.id })
  })

  it.each([0, 1])('detaches every piece of a long row when piece %i becomes manual', (pieceIndex) => {
    setLongRow()
    const original = countertops()
    expect(original).toHaveLength(2)
    expect(original.every((countertop) => countertop.autoCountertop)).toBe(true)
    expect(original.map((countertop) => countertop.params.width)).toEqual([3600, 1200])

    useAppStore.getState().detachCountertop(original[pieceIndex]!.id)

    expect(countertops()).toEqual(original.map(withoutAutomation))

    useAppStore.getState().updateFurnitureParams('base-0', { depth: 650 })
    expect(countertops()).toEqual(original.map(withoutAutomation))
  })

  it.each([0, 1])('deletes long-row piece %i without regenerating it and keeps other pieces manual', (pieceIndex) => {
    setLongRow()
    const original = countertops()
    expect(original).toHaveLength(2)
    const removedId = original[pieceIndex]!.id
    useAppStore.getState().select({ kind: 'furniture', id: removedId })

    useAppStore.getState().removeFurniture(removedId)

    const remaining = original.filter((countertop) => countertop.id !== removedId).map(withoutAutomation)
    expect(countertops()).toEqual(remaining)
    expect(useAppStore.getState().selection).toBeNull()

    useAppStore.getState().updateFurnitureParams('base-3', { depth: 650 })
    expect(countertops()).toEqual(remaining)
  })
})

describe('automatic countertop persistence', () => {
  it('restores metadata, recomputes saved geometry and preserves a legacy manual countertop', async () => {
    const manual = makeFurniture('countertop', {
      id: 'manual',
      position: { x: 2000, y: 1800 },
      elevation: 820,
      params: { ...makeFurniture('countertop').params, width: 1800, depth: 650 },
    })
    useAppStore.setState({ furniture: [base('base', 1000), manual] })
    useAppStore.getState().addCountertopForRow('base')
    const countertopId = countertops().find((candidate) => candidate.autoCountertop)!.id
    const saved = JSON.parse(localStorage.getItem('future-furniture-project')!) as {
      state: { furniture: FurnitureItem[] }
    }
    const savedTop = saved.state.furniture.find((candidate) => candidate.id === countertopId)!
    expect(savedTop.autoCountertop).toEqual({ supportIds: ['base'], frontOverhang: 40 })
    savedTop.params.width = 3200
    savedTop.elevation = 1000
    savedTop.position = { x: 2500, y: 1500 }

    resetStore()
    localStorage.setItem('future-furniture-project', JSON.stringify(saved))
    await useAppStore.persist.rehydrate()

    expect(item(countertopId)).toMatchObject({
      position: { x: 1000, y: 350 },
      elevation: 820,
      params: { width: 600, depth: 600 },
      autoCountertop: { supportIds: ['base'], frontOverhang: 40 },
    })
    expect(item('manual')).toEqual(manual)

    useAppStore.getState().updateFurnitureParams('base', { width: 1000 })
    expect(item(countertopId).params.width).toBe(1000)
    expect(item('manual')).toEqual(manual)
  })
})
