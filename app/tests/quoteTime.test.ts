import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseTimeEstimate, formatEta, isQuoteStale, TIME_UNAVAILABLE } from '../src/quoteTime.ts'

test('maps documented timeEstimate seconds', () => {
  assert.equal(parseTimeEstimate(37), 37); assert.equal(parseTimeEstimate(120), 120); assert.equal(parseTimeEstimate('15'), 15)
})
test('missing/invalid estimate -> null -> "Time unavailable"', () => {
  for (const v of [undefined, null, '', 'abc', 0, -5, NaN, Infinity, 10 ** 9, {}]) assert.equal(parseTimeEstimate(v), null)
  assert.equal(formatEta(null), TIME_UNAVAILABLE); assert.equal(formatEta(undefined), TIME_UNAVAILABLE); assert.equal(TIME_UNAVAILABLE, 'Time unavailable')
})
test('formats per quote value, no constant', () => {
  assert.equal(formatEta(12), '~12s'); assert.equal(formatEta(37), '~37s'); assert.equal(formatEta(600), '~10 min'); assert.equal(formatEta(7200), '~2.0 h')
  assert.notEqual(formatEta(12), formatEta(300))
})
test('stale/expiry detection', () => {
  const now = Date.parse('2026-11-05T20:00:40Z')
  assert.equal(isQuoteStale('2026-11-05T20:00:20Z', now), false)
  assert.equal(isQuoteStale('2026-11-05T20:00:00Z', now), true)
  assert.equal(isQuoteStale(undefined, now), true)
})
test('no hardcoded ETA left in quote UI/data flow', () => {
  const src = ['src/App.tsx', 'src/live.ts', 'src/brain.ts'].map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n')
  assert.doesNotMatch(src, /~37s|\b37\s*s\b|eta:\s*\d/)
  assert.doesNotMatch(src, /~\$\{[^}]*eta\}s/) // raw "~${eta}s" bypassing formatEta
  assert.match(src, /parseTimeEstimate\(q\.timeEstimate\)/)
})
test('latest-request-wins guard present in useQuote', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(app, /quoteSeq\.current/); assert.match(app, /setSt\(\{ q: null, loading: true, err: null, forKey: dep \}\)/)
})

import { quoteVisible } from '../src/uiLogic.ts'

test('ETA from a previous route key is not visible under the new key', () => {
  const stale = { q: { eta: 37, at: new Date().toISOString() }, forKey: '1|SOL|USDC' }
  assert.equal(quoteVisible(stale, '1|SOL|USDC')?.eta, 37)
  assert.equal(quoteVisible(stale, '1|ETH|SOL'), null) // route changed → old ~37s must not render
  assert.equal(quoteVisible({ q: { eta: 22 }, forKey: 'a' }, 'b'), null)
})

test('useQuote clears quote on dep change and tags PROVIDER/STALE not LIVE settlement', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const uq = app.slice(app.indexOf('function useQuote'), app.indexOf('function useQuote') + 1800)
  assert.match(uq, /setSt\(\{ q: null, loading: true/)
  assert.match(uq, /forKey: dep/)
  assert.match(uq, /id !== quoteSeq\.current/)
  assert.doesNotMatch(app, /LIVE QUOTE/) // dry quotes must not wear a LIVE settlement badge
  assert.match(app, /PROVIDER QUOTE/)
  assert.match(app, /STALE QUOTE/)
})
