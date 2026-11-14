/** Explicit tap-to-talk via the browser Speech Recognition API. Never always-on, never a wake word. */

export type ListenError = 'denied' | 'error' | 'unsupported'

export type ListenHandlers = {
  onListening: () => void
  onInterim?: (text: string) => void
  onFinal: (text: string) => void
  onError: (kind: ListenError, message: string) => void
  onEnd: () => void
}

function ctor(): (new () => SpeechRec) | null {
  const w = typeof window === 'undefined' ? undefined : window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }
  return (w && (w.SpeechRecognition || w.webkitSpeechRecognition)) || null
}

export function speechSupported() {
  return !!ctor()
}

type SpeechRec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
  stop: () => void
}

const DENIED = 'Microphone permission was denied. You can type instead.'
const UNSUPPORTED = 'Voice input isn’t available in this browser. Type below instead. Support varies, especially on iOS Safari.'
const FAIL = 'Voice input failed. You can type instead.'
const QUIET = 'I didn’t catch that. Tap Hey ORI to try again, or type below.'

/** Starts one recognition session after a user gesture. Caller must abort on close, navigation away from chat, or unmount. Does not restart itself. */
export function startTapToTalk(handlers: ListenHandlers): () => void {
  const SR = ctor()
  if (!SR) { handlers.onError('unsupported', UNSUPPORTED); return () => {} }
  let closed = false
  const rec = new SR()
  rec.continuous = false
  rec.interimResults = true
  rec.lang = 'en-US'
  rec.onresult = ev => {
    if (closed) return
    let interim = ''
    let final = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const piece = ev.results[i][0]?.transcript || ''
      if (ev.results[i].isFinal) final += piece
      else interim += piece
    }
    if (interim.trim()) handlers.onInterim?.(interim.trim())
    if (final.trim()) handlers.onFinal(final.trim())
  }
  rec.onerror = ev => {
    if (closed) return
    const err = ev.error || ''
    if (err === 'aborted') return
    if (err === 'not-allowed' || err === 'service-not-allowed') handlers.onError('denied', DENIED)
    else if (err === 'no-speech') handlers.onError('error', QUIET)
    else handlers.onError('error', FAIL)
  }
  rec.onend = () => { if (!closed) handlers.onEnd() }
  try {
    rec.start()
    if (!closed) handlers.onListening()
  } catch {
    handlers.onError('unsupported', UNSUPPORTED)
    return () => { closed = true }
  }
  return () => {
    closed = true
    try { rec.abort() } catch { /* already stopped */ }
  }
}
