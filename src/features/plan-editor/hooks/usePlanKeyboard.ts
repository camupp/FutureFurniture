import { useEffect } from 'react'
import { useAppStore } from '@/application/project'

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
}

export function usePlanKeyboard(onEscape: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return
      const state = useAppStore.getState()
      if (event.key === 'Escape') {
        onEscape()
        state.select(null)
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const current = state.selection
      if (!current) return
      if (current.kind === 'furniture') state.removeFurniture(current.id)
      else if (current.kind === 'wall') state.removeWall(current.id)
      else if (current.kind === 'opening') state.removeOpening(current.id)
      else state.removeUtility(current.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onEscape])
}
