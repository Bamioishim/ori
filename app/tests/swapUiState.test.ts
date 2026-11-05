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
  const a = sw.indexOf('blocked={'), b = sw.indexOf('limit={limit}', a); assert.ok(a > 0 && b > a, 'blocked expression found')
  const e = sw.slice(a, b)
  assert.match(e, /!\(n > 0\) \? 'Enter an amount'/)
  assert.equal(e.split("'Enter an amount'").length - 1, 1)
  assert.match(e, /overBal \?/)
  assert.match(e, /!canQuote \? \(routeNote \|\| 'No quote for this route'\)/)
  assert.match(e, /q\.err && !q\.q \? 'Live quote unavailable'/)
  assert.match(e, /q\.loading \? 'Waiting for a live quote'/)
  assert.match(e, /'No live quote yet · try again'/)
  // Waiting only when there is no quote on screen
  assert.ok(e.indexOf('!q.q') < e.indexOf("q.loading ? 'Waiting"))
})
