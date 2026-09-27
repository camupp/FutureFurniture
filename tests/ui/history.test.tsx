import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { canUndo, useAppStore } from '@/application/project'
import { EditorHeader } from '@/app/components/EditorHeader'
import { useHistoryKeyboard } from '@/app/useHistoryKeyboard'
import { PropertiesPanel } from '@/features/properties'
import { makeFurniture, makeRoom } from '../fixtures'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useAppStore.setState({ ...useAppStore.getInitialState(), room: makeRoom(), furniture: [makeFurniture()] }, true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function HistoryProbe({ enabled = true }: { enabled?: boolean }) {
  useHistoryKeyboard(enabled)
  return (
    <>
      <input aria-label="Название" />
      <div contentEditable suppressContentEditableWarning>
        <span>Текст</span>
      </div>
    </>
  )
}

function changeSlider(input: HTMLInputElement, value: number) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('enables history buttons only when an action is available', () => {
  act(() => root.render(<EditorHeader projectName="Кухня" saving={false} onOpenProjects={() => undefined} />))
  const undo = container.querySelector<HTMLButtonElement>('[aria-label="Отменить"]')!
  const redo = container.querySelector<HTMLButtonElement>('[aria-label="Повторить"]')!
  expect(undo.disabled).toBe(true)
  expect(redo.disabled).toBe(true)
  act(() => useAppStore.getState().setWallHeight(2800))
  expect(undo.disabled).toBe(false)
  act(() => undo.click())
  expect(useAppStore.getState().room.wallHeight).toBe(2700)
  expect(redo.disabled).toBe(false)
  act(() => redo.click())
  expect(useAppStore.getState().room.wallHeight).toBe(2800)
})

it('supports Mac, Windows and Russian-layout shortcuts without intercepting text editing or dialogs', () => {
  act(() => root.render(<HistoryProbe />))
  useAppStore.getState().setWallHeight(2800)
  const shortcut = (target: EventTarget, options: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options })
    act(() => target.dispatchEvent(event))
    return event
  }
  expect(shortcut(container.querySelector('input')!, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false)
  expect(shortcut(container.querySelector('span')!, { key: 'z', metaKey: true }).defaultPrevented).toBe(false)
  expect(useAppStore.getState().room.wallHeight).toBe(2800)
  expect(shortcut(window, { key: 'я', code: 'KeyZ', metaKey: true }).defaultPrevented).toBe(true)
  expect(useAppStore.getState().room.wallHeight).toBe(2700)
  shortcut(window, { key: 'Z', ctrlKey: true, shiftKey: true })
  expect(useAppStore.getState().room.wallHeight).toBe(2800)
  act(() => root.render(<HistoryProbe enabled={false} />))
  expect(shortcut(window, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false)
  expect(useAppStore.getState().room.wallHeight).toBe(2800)
})

it('records each complete pointer gesture on a properties slider as one step', () => {
  useAppStore.setState({
    furniture: [
      makeFurniture('cabinet', { cabinetModule: { familyId: 'base-storage', version: 1, facade: 'double-door' } }),
    ],
  })
  useAppStore.getState().select({ kind: 'furniture', id: 'cabinet-1' })
  act(() => root.render(<PropertiesPanel />))
  const slider = container.querySelector<HTMLInputElement>('[aria-label="Ширина: ползунок"]')!
  act(() => slider.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  changeSlider(slider, 700)
  changeSlider(slider, 800)
  changeSlider(slider, 900)
  act(() => slider.dispatchEvent(new Event('pointerup', { bubbles: true })))
  expect(useAppStore.getState().history.past).toHaveLength(1)
  act(() => useAppStore.getState().undo())
  expect(useAppStore.getState().furniture[0]?.params.width).toBe(600)
  expect(canUndo(useAppStore.getState())).toBe(false)
  act(() => useAppStore.getState().redo())
  expect(slider.value).toBe('900')
})

it('finishes keyboard and cancelled slider gestures without merging the following edit', () => {
  act(() => root.render(<PropertiesPanel />))
  const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!
  act(() => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  changeSlider(slider, 2800)
  changeSlider(slider, 2900)
  act(() => slider.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true })))
  act(() => slider.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  changeSlider(slider, 3000)
  act(() => slider.dispatchEvent(new Event('pointercancel', { bubbles: true })))
  expect(useAppStore.getState().history.past).toHaveLength(2)
  act(() => useAppStore.getState().undo())
  expect(useAppStore.getState().room.wallHeight).toBe(2900)
  act(() => useAppStore.getState().undo())
  expect(useAppStore.getState().room.wallHeight).toBe(2700)
})

it('finishes an active slider edit when the properties form unmounts', () => {
  act(() => root.render(<PropertiesPanel />))
  const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!
  act(() => slider.dispatchEvent(new Event('pointerdown', { bubbles: true })))
  changeSlider(slider, 2800)
  act(() => root.render(null))
  expect(useAppStore.getState().history.group).toBeNull()
  useAppStore.getState().setWallHeight(2900)
  useAppStore.getState().undo()
  expect(useAppStore.getState().room.wallHeight).toBe(2800)
})
