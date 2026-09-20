import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../src/shared/store'
import { utilityPoint } from '../../src/shared/utils/utilities'
import { blocksOverlap } from '../../src/shared/utils/collision'
import { makeRoom } from '../fixtures'
import { makeFurniture } from '../fixtures'
import { furnitureFromWallAnchor } from '../../src/shared/utils/wallAnchors'

function resetStore() {
  localStorage.clear()
  useAppStore.setState(
    {
      ...useAppStore.getInitialState(),
      room: makeRoom(),
      furniture: [],
      selection: null,
      tool: 'select',
      viewMode: 'split',
      editorView: 'plan',
    },
    true,
  )
}

beforeEach(resetStore)

describe('opening actions', () => {
  it('adds a normalized opening and selects it', () => {
    useAppStore.getState().addOpening('top', 1800, 'window')
    const state = useAppStore.getState()
    expect(state.room.openings).toHaveLength(1)
    expect(state.room.openings[0]).toMatchObject({ wallId: 'top', offset: 1800, type: 'window' })
    expect(state.selection).toEqual({ kind: 'opening', id: state.room.openings[0]?.id })
    expect(state.tool).toBe('select')
  })

  it('does not create an opening for an unknown wall', () => {
    useAppStore.getState().addOpening('missing', 500, 'door')
    expect(useAppStore.getState().room.openings).toEqual([])
  })
})

describe('utility actions', () => {
  it('creates and positions a wall-mounted utility', () => {
    useAppStore.getState().addUtility({ x: 1200, y: 0 }, 'water', { kind: 'wall', wallId: 'top', offset: 1200 })
    const state = useAppStore.getState()
    const utility = state.room.utilities[0]!
    expect(utility.mount).toEqual({ kind: 'wall', wallId: 'top', offset: 1200 })
    expect(utility.height).toBe(500)
    expect(utilityPoint(utility, state.room)).toEqual({ x: 1200, y: 74 })
  })

  it('keeps a dragged wall utility on its wall', () => {
    useAppStore.getState().addUtility({ x: 1200, y: 0 }, 'water', { kind: 'wall', wallId: 'top', offset: 1200 })
    const id = useAppStore.getState().room.utilities[0]!.id
    useAppStore.getState().moveUtility(id, { x: 2450, y: 1400 })
    const state = useAppStore.getState()
    const utility = state.room.utilities[0]!
    expect(utility.mount).toEqual({ kind: 'wall', wallId: 'top', offset: 2450 })
    expect(utilityPoint(utility, state.room).y).toBe(74)
  })

  it('removes wall-owned openings and utilities together with the wall', () => {
    useAppStore.getState().addOpening('top', 1800, 'window')
    useAppStore.getState().addUtility({ x: 1200, y: 0 }, 'water', { kind: 'wall', wallId: 'top', offset: 1200 })
    useAppStore.getState().removeWall('top')
    const state = useAppStore.getState()
    expect(state.room.walls.some((wall) => wall.id === 'top')).toBe(false)
    expect(state.room.openings).toEqual([])
    expect(state.room.utilities).toEqual([])
    expect(state.selection).toBeNull()
  })

  it('normalizes owned objects when the wall becomes shorter', () => {
    useAppStore.getState().addOpening('top', 1800, 'window')
    useAppStore.getState().addUtility({ x: 2500, y: 0 }, 'water', { kind: 'wall', wallId: 'top', offset: 2500 })
    useAppStore.getState().updateWallLength('top', 1000)
    const state = useAppStore.getState()
    expect(state.room.walls[0]?.end.x).toBe(1200)
    expect(state.room.openings[0]?.offset).toBe(600)
    expect(state.room.utilities[0]?.mount).toEqual({ kind: 'wall', wallId: 'top', offset: 1200 })
  })
})

describe('persistence migration', () => {
  it('loads a legacy utility without mount as a floor utility', async () => {
    const room = makeRoom()
    const legacyUtility = {
      id: 'legacy-water',
      type: 'water',
      point: { x: 1000, y: 500 },
      height: 500,
    }
    localStorage.setItem(
      'future-furniture-project',
      JSON.stringify({
        state: { room: { ...room, utilities: [legacyUtility] }, furniture: [], viewMode: '2d' },
        version: 0,
      }),
    )

    await useAppStore.persist.rehydrate()
    const state = useAppStore.getState()
    expect(state.room.utilities[0]).toMatchObject({
      id: 'legacy-water',
      mount: { kind: 'floor' },
      height: 0,
    })
    expect(state.viewMode).toBe('2d')
  })

  it('restores the wall attachment of legacy furniture that was snapped to a wall', async () => {
    const room = makeRoom()
    const legacyFurniture = makeFurniture('cabinet', { position: { x: 1000, y: 330 }, rotation: 0 })
    localStorage.setItem(
      'future-furniture-project',
      JSON.stringify({ state: { room, furniture: [legacyFurniture], viewMode: 'split' }, version: 0 }),
    )

    await useAppStore.persist.rehydrate()
    expect(useAppStore.getState().furniture[0]?.wallAnchor).toEqual({
      wallId: 'top',
      side: 'left',
      offset: 1000,
      distance: 0,
    })
  })
})

describe('wall-attached furniture actions', () => {
  it('stores an attachment after a smart drop', () => {
    useAppStore.getState().addBlock({
      type: 'cabinet',
      elevation: 0,
      params: makeFurniture().params,
    })
    const id = useAppStore.getState().furniture[0]!.id
    useAppStore.getState().dropFurniture(id, { x: 1000, y: 200 })

    expect(useAppStore.getState().furniture[0]).toMatchObject({
      position: { x: 1000, y: 330 },
      rotation: 0,
      wallAnchor: { wallId: 'top', side: 'left', offset: 1000, distance: 0 },
    })
  })

  it('moves attached furniture together with a shifted wall', () => {
    const room = makeRoom()
    const source = makeFurniture('cabinet', {
      wallAnchor: { wallId: 'right', side: 'left', offset: 1000, distance: 0 },
    })
    const attached = furnitureFromWallAnchor(source, room.walls[1]!)
    useAppStore.setState({ furniture: [attached] })

    useAppStore.getState().updateWallLength('top', 4000)
    expect(useAppStore.getState().furniture[0]).toMatchObject({
      position: { x: 3670, y: 1000 },
      rotation: 90,
      wallAnchor: { wallId: 'right', offset: 1000 },
    })
  })

  it('detaches furniture without deleting it when its wall is removed', () => {
    const room = makeRoom()
    const source = makeFurniture('cabinet', {
      wallAnchor: { wallId: 'top', side: 'left', offset: 1000, distance: 0 },
    })
    useAppStore.setState({ furniture: [furnitureFromWallAnchor(source, room.walls[0]!)] })

    useAppStore.getState().removeWall('top')
    expect(useAppStore.getState().furniture).toHaveLength(1)
    expect(useAppStore.getState().furniture[0]?.wallAnchor).toBeUndefined()
    expect(useAppStore.getState().furniture[0]?.position).toEqual({ x: 1000, y: 330 })
  })

  it('moves a resized cabinet to the free place in its wall row', () => {
    const room = makeRoom()
    const wall = room.walls[0]!
    const first = furnitureFromWallAnchor(
      makeFurniture('cabinet', {
        id: 'first',
        wallAnchor: { wallId: wall.id, side: 'left', offset: 1000, distance: 0 },
      }),
      wall,
    )
    const second = furnitureFromWallAnchor(
      makeFurniture('cabinet', {
        id: 'second',
        wallAnchor: { wallId: wall.id, side: 'left', offset: 1600, distance: 0 },
      }),
      wall,
    )
    useAppStore.setState({ furniture: [first, second], smartPlacement: true })

    useAppStore.getState().updateFurnitureParams('second', { width: 1200 })
    const [nextFirst, nextSecond] = useAppStore.getState().furniture
    expect(nextSecond).toMatchObject({
      position: { x: 1900, y: 330 },
      wallAnchor: { wallId: 'top', side: 'left', offset: 1900, distance: 0 },
    })
    expect(blocksOverlap(nextFirst!, nextSecond!)).toBe(false)
  })

  it('reprojects an attached cabinet after a depth change', () => {
    const room = makeRoom()
    const wall = room.walls[0]!
    const item = furnitureFromWallAnchor(
      makeFurniture('cabinet', {
        id: 'cabinet',
        wallAnchor: { wallId: wall.id, side: 'left', offset: 1500, distance: 0 },
      }),
      wall,
    )
    useAppStore.setState({ furniture: [item] })

    useAppStore.getState().updateFurnitureParams('cabinet', { depth: 700 })
    expect(useAppStore.getState().furniture[0]).toMatchObject({
      position: { x: 1500, y: 400 },
      wallAnchor: { wallId: 'top', side: 'left', offset: 1500, distance: 0 },
    })
  })

  it('clamps an exact wall offset to the clear corner range', () => {
    const room = makeRoom()
    const wall = room.walls[0]!
    const item = furnitureFromWallAnchor(
      makeFurniture('cabinet', {
        id: 'wide',
        params: { ...makeFurniture().params, width: 1200 },
        wallAnchor: { wallId: wall.id, side: 'left', offset: 1000, distance: 0 },
      }),
      wall,
    )
    useAppStore.setState({ furniture: [item] })

    useAppStore.getState().moveFurnitureAlongWall('wide', 0)
    expect(useAppStore.getState().furniture[0]).toMatchObject({
      position: { x: 650, y: 330 },
      wallAnchor: { wallId: 'top', offset: 650 },
    })
  })
})
