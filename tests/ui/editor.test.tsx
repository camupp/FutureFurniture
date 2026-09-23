import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type Konva from 'konva'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAppStore } from '@/application/project'
import { PropertiesPanel } from '@/features/properties'
import { usePlanKeyboard } from '@/features/plan-editor/hooks/usePlanKeyboard'
import { usePlanTools } from '@/features/plan-editor/hooks/usePlanTools'
import { useAddMenu } from '@/features/plan-editor/hooks/useAddMenu'
import { NumberField } from '@/shared/ui/NumberField'
import { makeFurniture, makeOpening, makeRoom, makeUtility } from '../fixtures'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  localStorage.clear()
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [] }, true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function render(node: ReactNode) {
  act(() => root.render(node))
}

it('routes each selection to the corresponding property form', () => {
  useAppStore.setState({
    room: makeRoom({ openings: [makeOpening('window')], utilities: [makeUtility('water')] }),
    furniture: [makeFurniture()],
  })
  render(<PropertiesPanel />)
  expect(container.textContent).toContain('Ничего не выбрано')
  for (const [kind, id, label] of [
    ['wall', 'top', 'Удалить стену'],
    ['opening', 'window-1', 'Удалить окно'],
    ['utility', 'water-1', 'Крепление: пол'],
    ['furniture', 'cabinet-1', 'Удалить блок'],
  ] as const) {
    act(() => useAppStore.getState().select({ kind, id }))
    expect(container.textContent).toContain(label)
  }
})

it('keeps a number field draft local and clamps only on commit', () => {
  const change = vi.fn()
  render(<NumberField label="Ширина" value={600} min={300} max={1200} step={10} onChange={change} />)
  const input = container.querySelector<HTMLInputElement>('input[type=number]')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '1500')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(input.value).toBe('1500')
  expect(change).not.toHaveBeenCalled()
  act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  expect(change).toHaveBeenCalledExactlyOnceWith(1200)
})

it('does not delete furniture while typing and clears selection on Escape', () => {
  const escape = vi.fn()
  function KeyboardProbe() {
    usePlanKeyboard(escape)
    return <input />
  }
  useAppStore.setState({ furniture: [makeFurniture()], selection: { kind: 'furniture', id: 'cabinet-1' } })
  render(<KeyboardProbe />)
  act(() =>
    container.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true })),
  )
  expect(useAppStore.getState().furniture).toHaveLength(1)
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(escape).toHaveBeenCalledOnce()
  expect(useAppStore.getState().selection).toBeNull()
  act(() => useAppStore.getState().select({ kind: 'furniture', id: 'cabinet-1' }))
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })))
  expect(useAppStore.getState().furniture).toEqual([])
})

it('preserves wall drawing, orthogonal snapping and vertex loop closure after hook extraction', () => {
  let tools: ReturnType<typeof usePlanTools>
  function ToolsProbe() {
    tools = usePlanTools(1)
    return null
  }
  useAppStore.setState({ room: makeRoom({ walls: [] }), tool: 'wall' })
  render(<ToolsProbe />)
  let pointer = { x: 0, y: 0 }
  const stage = { getPointerPosition: () => pointer, x: () => 0, y: () => 0, scaleX: () => 1, scaleY: () => 1 }
  const event = { target: { getStage: () => stage } } as unknown as Konva.KonvaEventObject<MouseEvent>
  const click = (x: number, y: number) => {
    pointer = { x, y }
    act(() => tools.handlePointerDown(event))
  }
  click(0, 0)
  click(1000, 20)
  expect(useAppStore.getState().room.walls[0]).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } })
  click(1000, 1000)
  click(0, 1000)
  click(4, 3)
  expect(tools!.draft).toBeNull()
  expect(useAppStore.getState().room.walls).toHaveLength(4)
})

it('opens the floor menu on long press, cancels on movement and clears the timer on unmount', () => {
  vi.useFakeTimers()
  let menu: ReturnType<typeof useAddMenu>
  const stopDrag = vi.fn()
  const stage = {
    getPointerPosition: () => ({ x: 1800, y: 1500 }),
    x: () => 0,
    y: () => 0,
    scaleX: () => 1,
    scaleY: () => 1,
    getStage: (): unknown => stage,
    stopDrag,
  }
  function MenuProbe() {
    menu = useAddMenu({
      containerRef: { current: container },
      scale: 1,
      handlePointerDown: vi.fn(),
      handlePointerMove: vi.fn(),
      handleTouchMove: vi.fn(),
      handleTouchEnd: vi.fn(),
    })
    return null
  }
  const touch = (x: number) =>
    ({
      target: stage,
      evt: { touches: [{ clientX: x, clientY: 40 }] },
    }) as unknown as Konva.KonvaEventObject<TouchEvent>
  render(<MenuProbe />)
  act(() => menu.handleTouchStart(touch(30)))
  act(() => vi.advanceTimersByTime(550))
  expect(menu!.addMenu).toMatchObject({ kind: 'floor', point: { x: 1800, y: 1500 } })
  expect(stopDrag).toHaveBeenCalledOnce()

  act(() => menu.setAddMenu(null))
  act(() => menu.handleTouchStart(touch(30)))
  act(() => menu.handleRoomTouchMove(touch(60)))
  act(() => vi.advanceTimersByTime(550))
  expect(menu!.addMenu).toBeNull()
  expect(stopDrag).toHaveBeenCalledOnce()

  act(() => menu.handleTouchStart(touch(30)))
  render(null)
  expect(vi.getTimerCount()).toBe(0)
})
