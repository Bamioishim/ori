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
  assert.match(app, /id === quoteSeq\.current/); assert.match(app, /setSt\(\{ q: null, loading: true, err: null \}\)/)
})
