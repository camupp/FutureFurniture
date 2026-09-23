import { useEffect } from 'react'
import { useAppStore } from '@/application/project'

function isTextEditing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('[contenteditable]:not([contenteditable="false"]), textarea, select, [role="textbox"]'))
    return true
  return target instanceof HTMLInputElement && !['range', 'button', 'checkbox', 'radio'].includes(target.type)
}

/** Application-wide shortcuts also work when only the 3D view is visible. */
export function useHistoryKeyboard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || isTextEditing(event.target)) return
      if (!event.metaKey && !event.ctrlKey) return
      const key = event.key.toLowerCase()
      // Physical keys keep shortcuts available with the Russian keyboard layout.
      const undoKey = key === 'z' || event.code === 'KeyZ'
      const redoKey = key === 'y' || event.code === 'KeyY'
      if (!undoKey && !redoKey) return
      event.preventDefault()
      const state = useAppStore.getState()
      if (redoKey || event.shiftKey) state.redo()
      else state.undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
