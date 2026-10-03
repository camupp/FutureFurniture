import { act, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/application/project'
import { App } from '@/app/App'

const session = vi.hoisted(() => ({ currentId: 'first', activePlans: 0, activeScenes: 0 }))

vi.mock('@/app/useProjectSession', () => ({
  useProjectSession: () => ({
    phase: 'ready',
    currentId: session.currentId,
    projects: [],
    busy: false,
    saving: false,
    error: null,
  }),
}))
vi.mock('@/application/project', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/application/project')>()),
  projectSession: { initialize: vi.fn().mockResolvedValue(undefined), hasPendingChanges: () => false },
}))
vi.mock('@/features/plan-editor', () => ({
  RoomEditor: function Plan() {
    useEffect(() => {
      session.activePlans++
      return () => {
        session.activePlans--
      }
    }, [])
    return <div data-testid="room-editor" />
  },
}))
vi.mock('@/features/scene-3d', () => ({
  downloadSceneScreenshot: vi.fn(),
  Scene3D: function Scene() {
    useEffect(() => {
      session.activeScenes++
      return () => {
        session.activeScenes--
      }
    }, [])
    return <div data-testid="scene-3d" />
  },
}))
vi.mock('@/features/elevation-editor', () => ({ ElevationEditor: () => <div data-testid="elevation-editor" /> }))
vi.mock('@/features/properties', () => ({ PropertiesPanel: () => <aside /> }))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  session.currentId = 'first'
  session.activePlans = 0
  session.activeScenes = 0
  useAppStore.setState({ ...useAppStore.getInitialState(), viewMode: 'split' }, true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('replaces the previous workspace on every project switch instead of accumulating editors', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  for (const id of ['first', 'second', 'first', 'third', 'second']) {
    session.currentId = id
    await act(async () =>
      root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      ),
    )
    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="room-editor"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-testid="scene-3d"]')).toHaveLength(1)
    expect(container.querySelectorAll('aside')).toHaveLength(1)
    expect(session.activePlans).toBe(1)
    expect(session.activeScenes).toBe(1)
  }
  expect(errors.mock.calls.flat().join(' ')).not.toContain('same key')
})

it('keeps one workspace while the kitchen proposal controls change repeatedly', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await act(async () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  const open = [...container.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === 'Собрать кухню',
  )!
  act(() => open.click())

  const wall = container.querySelector<HTMLSelectElement>('#generator-wall')!
  const prep = container.querySelector<HTMLSelectElement>('#generator-prep')!
  const storage = container.querySelector<HTMLSelectElement>('#generator-storage')!
  for (const [input, values] of [
    [wall, [...wall.options].map((option) => option.value)],
    [prep, ['1200', '600']],
    [storage, ['more-storage', 'balanced']],
  ] as const) {
    for (const value of values) {
      act(() => {
        input.value = value
        input.dispatchEvent(new Event('change', { bubbles: true }))
      })
      expect(container.querySelectorAll('main')).toHaveLength(1)
      expect(container.querySelectorAll('[data-testid="room-editor"]')).toHaveLength(1)
      expect(container.querySelectorAll('[data-testid="scene-3d"]')).toHaveLength(1)
    }
  }
  for (const checkbox of container.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')) {
    act(() => checkbox.click())
    expect(container.querySelectorAll('main')).toHaveLength(1)
  }
  act(() => container.querySelector<HTMLButtonElement>('[aria-label="Закрыть генератор"]')!.click())
  expect(container.querySelectorAll('main')).toHaveLength(1)
  expect(container.querySelectorAll('[role="dialog"]')).toHaveLength(0)
  act(() => open.click())
  expect(container.querySelectorAll('main')).toHaveLength(1)
  expect(errors.mock.calls.flat().join(' ')).not.toContain('same key')
})
