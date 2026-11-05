// Pure UI logic (no React) so behaviour is unit-tested. Original ORI code; generic patterns only.

// ---- Slide to confirm: deliberate full travel, once-only, keyboard two-step with the same explicit intent.
export type SlidePhase = 'idle' | 'drag' | 'armed' | 'done'
export type SlideState = { phase: SlidePhase; frac: number }
export type SlideEvent = { t: 'down' } | { t: 'move'; frac: number } | { t: 'up' } | { t: 'cancel' } | { t: 'key' } | { t: 'timeout' }
export const SLIDE_COMMIT = 0.98 // must reach (almost) the very end of the track while the pointer is still down
export const SLIDE_IDLE: SlideState = { phase: 'idle', frac: 0 }
export function slideStep(s: SlideState, e: SlideEvent, disabled: boolean): { s: SlideState; fire: boolean } {
  if (s.phase === 'done') return { s, fire: false } // once-only: nothing re-fires until the parent remounts/resets
  if (disabled) return { s: SLIDE_IDLE, fire: false }
  switch (e.t) {
    case 'down': return { s: s.phase === 'idle' ? { phase: 'drag', frac: 0 } : s, fire: false }
    case 'move': {
      if (s.phase !== 'drag') return { s, fire: false }
      const f = Math.min(1, Math.max(0, Number.isFinite(e.frac) ? e.frac : 0))
      return f >= SLIDE_COMMIT ? { s: { phase: 'done', frac: 1 }, fire: true } : { s: { phase: 'drag', frac: f }, fire: false }
    }
    case 'up': case 'cancel': return { s: s.phase === 'drag' ? SLIDE_IDLE : s.phase === 'armed' && e.t === 'cancel' ? SLIDE_IDLE : s, fire: false }
    case 'key': return s.phase === 'armed' ? { s: { phase: 'done', frac: 1 }, fire: true } : s.phase === 'idle' ? { s: { phase: 'armed', frac: 0 }, fire: false } : { s, fire: false }
    case 'timeout': return { s: s.phase === 'armed' ? SLIDE_IDLE : s, fire: false }
  }
}

// ---- One-time code: one logical field; paste/autofill friendly.
export const sanitizeOtp = (raw: string, n = 6) => String(raw ?? '').replace(/\D/g, '').slice(0, n)

// ---- Clipboard: success only when the browser actually wrote the text.
export async function copyText(text: string, clip: { writeText?: (t: string) => Promise<void> } | undefined = typeof navigator !== 'undefined' ? navigator.clipboard : undefined): Promise<boolean> {
  if (!text || !clip?.writeText) return false
  try { await clip.writeText(text); return true } catch { return false }
}

// ---- Private balance: mask digits only (keeps layout width stable); value is never altered.
export const maskDigits = (s: string) => s.replace(/\d/g, '•')

// ---- Price flow: which characters changed between two already-formatted strings. Display only.
export function flowParts(prev: string | null, next: string): { ch: string; changed: boolean }[] {
  const p = prev ?? next, off = next.length - p.length
  return [...next].map((ch, i) => ({ ch, changed: prev !== null && p[i - off] !== ch }))
}
