import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/application/project'
import { KitchenGeneratorPanel } from '@/features/kitchen-generator'
import type { FurnitureItem } from '@/domain/model'
import { makeRoom, makeUtility } from '../fixtures'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [] }, true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('shows a non-destructive preview and accepts it from the requirements form', () => {
  const onPreview = vi.fn()
  const onClose = vi.fn()
  act(() => root.render(<KitchenGeneratorPanel onPreview={onPreview} onClose={onClose} />))
  expect(container.querySelector('[aria-label="Предложенный ряд"]')).not.toBeNull()
  expect(onPreview).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ type: 'sink' })]))
  expect(useAppStore.getState().furniture).toEqual([])

  const prep = container.querySelector<HTMLSelectElement>('#generator-prep')!
  act(() => {
    prep.value = '1200'
    prep.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(container.textContent).toContain('Рабочая база с ящиками')
  expect(useAppStore.getState().furniture).toEqual([])

  const accept = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Принять вариант'),
  )!
  act(() => accept.click())
  expect(useAppStore.getState().furniture.length).toBeGreaterThan(0)
  expect(onClose).toHaveBeenCalledOnce()
})

it('explains missing room geometry and blocks acceptance', () => {
  useAppStore.setState({ room: makeRoom({ walls: [] }) })
  act(() => root.render(<KitchenGeneratorPanel onPreview={vi.fn()} onClose={vi.fn()} />))
  expect(container.textContent).toContain('Сначала замкните внешний контур')
  const accept = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Принять вариант'),
  )!
  expect(accept.hasAttribute('disabled')).toBe(true)
})

it('rebuilds the preview around a marked gas outlet when the hob type changes', () => {
  useAppStore.setState({
    room: makeRoom({
      utilities: [
        makeUtility('gas', { mount: { kind: 'wall', wallId: 'top', offset: 450 }, height: 900 }),
        makeUtility('water', { point: { x: 3150, y: 330 }, height: 500 }),
        makeUtility('sewer', { point: { x: 3150, y: 330 }, height: 300 }),
      ],
    }),
  })
  const onPreview = vi.fn()
  act(() => root.render(<KitchenGeneratorPanel onPreview={onPreview} onClose={vi.fn()} />))
  const before = onPreview.mock.calls.length
  const connection = container.querySelector<HTMLSelectElement>('#generator-hob-connection')!
  act(() => {
    connection.value = 'gas'
    connection.dispatchEvent(new Event('change', { bubbles: true }))
  })

  expect(onPreview.mock.calls.length).toBeGreaterThan(before)
  const preview = onPreview.mock.lastCall?.[0] as FurnitureItem[]
  const hob = preview.find((item) => item.type === 'hob')!
  expect(hob.hobConnection).toBe('gas')
  expect(Math.abs(hob.position.x - 450)).toBeLessThanOrEqual(300)
  expect(container.textContent).toContain('Совпало с отмеченными выводами: 3 из 3 требований')
  expect(useAppStore.getState().furniture).toEqual([])
})
