// "Hey Ori" wake word via Web Speech API (continuous). Falls back to tap-to-talk where unsupported.
type Cb = { onWake: (src: string) => void; onCommand: (text: string, src: string) => void; onState: (s: string) => void }
const WAKE = /\b(hey|hi|okay|ok)[,\s]+(ori|orri|orie|aury|ory|dory|laurie)\b/i
let awaiting = 0
export function speechSupported() { return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) }
// The single handler used by real recognition AND by the demo simulation.
export function handleHeard(text: string, cb: Cb, src = 'mic') {
  const t = text.trim()
  const m = t.match(WAKE)
  if (m) {
    const rest = t.slice((m.index || 0) + m[0].length).replace(/^[\s,.!]+/, '')
    cb.onWake(src)
    if (rest.length > 3) cb.onCommand(rest, src); else awaiting = Date.now()
    return
  }
  if (Date.now() - awaiting < 9000) { awaiting = 0; cb.onCommand(t, src) }
}
export function startListening(cb: Cb) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) { cb.onState('unsupported'); return () => { } }
  let on = true
  const rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US'
  rec.onresult = (e: any) => { const r = e.results[e.results.length - 1]; if (r.isFinal) handleHeard(r[0].transcript, cb) }
  rec.onerror = (e: any) => { if (e.error === 'not-allowed') { on = false; cb.onState('denied') } }
  rec.onend = () => { if (on) try { rec.start() } catch { } }
  try { rec.start(); cb.onState('listening') } catch { cb.onState('unsupported') }
  return () => { on = false; try { rec.stop() } catch { } cb.onState('off') }
}
export function speak(text: string) {
  try { if (!('speechSynthesis' in window)) return; const u = new SpeechSynthesisUtterance(text); u.rate = 1.05; u.pitch = 1.25; speechSynthesis.cancel(); speechSynthesis.speak(u) } catch { }
}
// scripted mock "AI" parser → structured action. Never executes; the UI asks the human to confirm.
export type Action = { kind: 'pay'; to: string; amt: string } | { kind: 'swap' } | { kind: 'hide' } | { kind: 'show' } | { kind: 'balance' } | { kind: 'unknown' }
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 }
export function parse(text: string): Action {
  const t = text.toLowerCase()
  const m = t.match(/(?:send|pay|give)\s+(?:\$\s?)?(\d+(?:\.\d+)?|[a-z]+)\s*(?:dollars?|usd|usdc|bucks)?\s+to\s+(@?[\w.@+-]+)/)
  if (m) { const n = isNaN(+m[1]) ? NUM[m[1]] : +m[1]; if (n) return { kind: 'pay', amt: String(n), to: m[2].startsWith('@') || m[2].includes('@') || /^\+?\d+$/.test(m[2]) ? m[2] : '@' + m[2] } }
  if (/swap|convert|exchange/.test(t)) return { kind: 'swap' }
  if (/hide/.test(t)) return { kind: 'hide' }
  if (/show|unhide/.test(t)) return { kind: 'show' }
  if (/balance|how much/.test(t)) return { kind: 'balance' }
  return { kind: 'unknown' }
}
