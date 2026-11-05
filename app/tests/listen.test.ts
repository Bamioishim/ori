import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { startTapToTalk, speechSupported } from '../src/listen.ts'

test('tap-to-talk is not continuous and does not auto-restart', () => {
  const src = readFileSync(new URL('../src/listen.ts', import.meta.url), 'utf8')
  assert.match(src, /continuous\s*=\s*false/)
  assert.doesNotMatch(src, /continuous\s*=\s*true/)
  assert.doesNotMatch(src, /onend\s*=\s*[^{]*\{[^}]*rec\.start/)
  assert.doesNotMatch(src, /WAKE\s*=/)
  assert.doesNotMatch(src, /getUserMedia/)
})

test('speechSupported is false without a browser recognition constructor', () => {
  const g = globalThis as any
  const prev = g.window
  g.window = {}
  try { assert.equal(speechSupported(), false) } finally { if (prev === undefined) delete g.window; else g.window = prev }
})

test('startTapToTalk reports unsupported without SpeechRecognition and never starts a mic', () => {
  const g = globalThis as any
  const prev = g.window
  g.window = {}
  let kind = ''
  let listening = 0
  const stop = startTapToTalk({
    onListening: () => { listening++ },
    onFinal: () => {},
    onError: k => { kind = k },
    onEnd: () => {},
  })
  assert.equal(kind, 'unsupported')
  assert.equal(listening, 0)
  stop()
  if (prev === undefined) delete g.window; else g.window = prev
})

test('startTapToTalk is a single shot: continuous false, abortable, no restart, transcript callback', () => {
  const g = globalThis as any
  const prev = g.window
  class Fake {
    static last: Fake
    continuous = true
    interimResults = false
    lang = ''
    onresult: any
    onerror: any
    onend: any
    starts = 0
    aborted = 0
    constructor() { Fake.last = this }
    start() { this.starts++ }
    abort() { this.aborted++; this.onend?.() }
    stop() { this.onend?.() }
  }
  g.window = { SpeechRecognition: Fake }
  const finals: string[] = []
  const interims: string[] = []
  let listening = 0
  let ended = 0
  const stop = startTapToTalk({
    onListening: () => { listening++ },
    onInterim: t => interims.push(t),
    onFinal: t => finals.push(t),
    onError: () => {},
    onEnd: () => { ended++ },
  })
  assert.equal(listening, 1)
  assert.equal(Fake.last.continuous, false)
  assert.equal(Fake.last.interimResults, true)
  assert.equal(Fake.last.starts, 1)
  Fake.last.onresult({
    resultIndex: 0,
    results: [
      { isFinal: false, 0: { transcript: 'pay tolu ' } },
    ],
  })
  Fake.last.onresult({
    resultIndex: 0,
    results: [
      { isFinal: true, 0: { transcript: 'pay tolu 20' } },
    ],
  })
  assert.deepEqual(interims, ['pay tolu'])
  assert.deepEqual(finals, ['pay tolu 20'])
  stop()
  assert.equal(Fake.last.aborted, 1)
  assert.equal(Fake.last.starts, 1)
  // abort triggers onend, but the session is closed so onEnd should not fire after abort
  assert.equal(ended, 0)
  if (prev === undefined) delete g.window; else g.window = prev
})

test('permission denied surfaces as denied without restarting', () => {
  const g = globalThis as any
  const prev = g.window
  class Fake {
    static last: Fake
    continuous = true
    interimResults = false
    lang = ''
    onresult: any
    onerror: any
    onend: any
    starts = 0
    start() { this.starts++ }
    abort() {}
    stop() {}
    constructor() { Fake.last = this }
  }
  g.window = { webkitSpeechRecognition: Fake }
  let kind = ''
  let msg = ''
  startTapToTalk({
    onListening: () => {},
    onFinal: () => {},
    onError: (k, m) => { kind = k; msg = m },
    onEnd: () => {},
  })
  Fake.last.onerror({ error: 'not-allowed' })
  assert.equal(kind, 'denied')
  assert.match(msg, /denied/i)
  assert.equal(Fake.last.starts, 1)
  if (prev === undefined) delete g.window; else g.window = prev
})
