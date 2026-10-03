import { beforeEach, expect, it } from 'vitest'
import { useAppStore } from '@/application/project'
import { normalizeProjectDocument, partializeProject } from '@/application/project/persistence'
import { generateStraightKitchen } from '@/domain/generation/straightKitchen'
import { makeRoom } from '../fixtures'

beforeEach(() => {
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [] }, true)
})

it('accepts preview atomically, supports one-step undo/redo, and survives project round-trip', () => {
  const state = useAppStore.getState()
  const proposal = generateStraightKitchen(state.room, state.furniture, {
    wallId: 'top',
    includeSink: true,
    includeHob: true,
  }).proposal!
  expect(state.furniture).toEqual([])
  expect(state.applyStraightKitchen(proposal, null)).toBeNull()
  const accepted = useAppStore.getState().furniture
  expect(accepted).toHaveLength(proposal.items.length)
  expect(accepted.every((item) => !item.id.startsWith('__straight-kitchen-preview__'))).toBe(true)
  expect(
    accepted
      .find((item) => item.autoCountertop)
      ?.autoCountertop?.supportIds.every((id) => accepted.some((item) => item.id === id)),
  ).toBe(true)
  const sinkBase = accepted.find(
    (item) => item.cabinetModule?.familyId === 'base-storage' && item.cabinetModule.role === 'sink',
  )!
  useAppStore.getState().setCabinetFacade(sinkBase.id, 'three-drawers')
  expect(useAppStore.getState().furniture.find((item) => item.id === sinkBase.id)?.cabinetModule?.facade).toBe(
    'single-door',
  )

  useAppStore.getState().undo()
  expect(useAppStore.getState().furniture).toEqual([])
  useAppStore.getState().redo()
  expect(useAppStore.getState().furniture).toEqual(accepted)

  const saved = partializeProject(useAppStore.getState())
  const loaded = normalizeProjectDocument(saved, useAppStore.getInitialState(), () => crypto.randomUUID())
  expect(loaded?.furniture).toEqual(accepted)
  expect(
    loaded?.furniture.find(
      (item) => item.cabinetModule?.familyId === 'base-storage' && item.cabinetModule.role === 'sink',
    ),
  ).toBeTruthy()
})

it('rejects a stale preview without changing the current project', () => {
  const state = useAppStore.getState()
  const proposal = generateStraightKitchen(state.room, state.furniture, {
    wallId: 'top',
    includeSink: false,
    includeHob: false,
  }).proposal!
  state.setWallHeight(2800)
  expect(useAppStore.getState().applyStraightKitchen(proposal, null)).toContain('изменился')

  useAppStore.setState({ activeProjectId: 'another-project' })
  expect(useAppStore.getState().applyStraightKitchen(proposal, null)).toContain('другой проект')
  expect(useAppStore.getState().furniture).toEqual([])
})

it('rejects malformed proposal geometry at the acceptance boundary', () => {
  const state = useAppStore.getState()
  const proposal = generateStraightKitchen(state.room, state.furniture, {
    wallId: 'top',
    includeSink: true,
    includeHob: true,
  }).proposal!
  const broken = {
    ...proposal,
    items: proposal.items.map((item, index) =>
      index === 0 ? { ...item, position: { x: -1000, y: -1000 }, wallAnchor: undefined } : item,
    ),
  }
  expect(state.applyStraightKitchen(broken, null)).toContain('проверку размещения')
  expect(useAppStore.getState().furniture).toEqual([])
})
