import { createContext, useContext, useEffect, useRef } from 'react'

// Private balance: hidden amounts render as masked digits everywhere Money is used; press-and-hold peeks while held.
export const MaskCtx = createContext<{ masked: boolean; hidden: boolean; peek: (on: boolean) => void }>({ masked: false, hidden: false, peek: () => {} })
export const useMask = () => useContext(MaskCtx)
export function usePeekHandlers(toggle: () => void) {
  const { hidden, peek } = useMask(); const t = useRef(0); const peeked = useRef(false)
  useEffect(() => () => clearTimeout(t.current), [])
  const end = () => { clearTimeout(t.current); if (peeked.current) peek(false) }
  return {
    'aria-label': hidden ? 'Balance hidden. Tap to show, or press and hold to peek' : 'Tap to hide balance',
    'aria-pressed': hidden,
    onPointerDown: () => { peeked.current = false; if (!hidden) return; t.current = window.setTimeout(() => { peeked.current = true; peek(true) }, 320) },
    onPointerUp: end, onPointerLeave: end, onPointerCancel: end, onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => { if (peeked.current) { peeked.current = false; return } toggle() },
  }
}
