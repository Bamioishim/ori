// Static regression for Swap button / route-note state (no App.tsx changes while funds code is under review).
// TODO after review: extract a pure swapBlockedLabel() helper and test it directly.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const sw = app.slice(app.indexOf('function Swap('), app.indexOf('function Earn('))
test('same asset on both sides points to Send, not "Pick two different assets"', () => {
  assert.doesNotMatch(sw, /Pick two different assets/)
  assert.match(sw, /from\.id === to\.id \? 'Same asset on the same chain: use Send \(direct transfer\)\.'/)
})
test('"Enter an amount" only when amount is not positive; API/route problems get their own label', () => {
  const a = sw.indexOf('blocked={!q.q ? ('), b = sw.indexOf(') : liveBlock', a); assert.ok(a > 0 && b > a, 'blocked expression found')
  const e = sw.slice(a + 'blocked={!q.q ? ('.length, b)
  assert.match(e, /^!\(n > 0\) \? 'Enter an amount' :/) // amount check first and only gate for that wording
  assert.equal(e.split("'Enter an amount'").length - 1, 1)
  assert.match(e, /!canQuote \? \(routeNote \|\| 'No quote for this route'\)/)
  assert.match(e, /q\.err \? 'Live quote unavailable'/)
  assert.ok(e.indexOf('!canQuote') < e.indexOf('q.loading'))
})
