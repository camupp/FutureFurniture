import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '../../src/shared/store'
import { utilityPoint } from '../../src/shared/utils/utilities'
import { makeRoom } from '../fixtures'

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
})
