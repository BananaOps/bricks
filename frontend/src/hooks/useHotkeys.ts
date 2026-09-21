import { useEffect, useRef } from 'react'

export interface HotkeyHandlers {
  openPalette: () => void
  undo: () => void
  escape: () => void
  /** Shift moves the trailing edge (duration); otherwise the brick slides. */
  nudgeWindow: (deltaMonths: number, resizing: boolean) => void
  nudgeEtp: (delta: number) => void
  remove: () => void
}

/** True when the event came from somewhere the user is typing. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * Global keyboard layer.
 *
 * Arrow keys edit the selected brick, which is the fastest way to make the
 * small corrections a plan mostly consists of — but only when the user is not
 * typing, so a title field keeps its own arrow behaviour. ⌘K, ⌘Z and Escape
 * work everywhere, including from inside a field.
 */
export function useHotkeys(handlers: HotkeyHandlers, hasSelection: boolean) {
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey
      const h = latest.current

      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        h.openPalette()
        return
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        h.undo()
        return
      }
      if (event.key === 'Escape') {
        h.escape()
        return
      }

      if (isTyping(event.target) || !hasSelection) return

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowLeft': {
          event.preventDefault()
          h.nudgeWindow(event.key === 'ArrowRight' ? 1 : -1, event.shiftKey)
          return
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          event.preventDefault()
          h.nudgeEtp(event.key === 'ArrowUp' ? 0.5 : -0.5)
          return
        }
        case 'Backspace':
        case 'Delete': {
          event.preventDefault()
          h.remove()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasSelection])
}
