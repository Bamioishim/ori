// Static regression for Swap button / route-note state.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const sw = app.slice(app.indexOf('function Swap('), app.indexOf('function Earn('))
test('same asset on both sides points to Send, not "Pick two different assets"', () => {
  assert.doesNotMatch(sw, /Pick two different assets/)
  assert.match(sw, /from\.id === to\.id \? 'Same asset on the same chain: use Send \(direct transfer\)\.'/)
})
test('"Enter an amount" / over-balance share amountAllowed; API/route problems get their own label', () => {
  const a = sw.indexOf('blocked={'), b = sw.indexOf('limit={limit}', a); assert.ok(a > 0 && b > a, 'blocked expression found')
  const e = sw.slice(a, b)
  assert.match(sw, /amountAllowed\(spend/)
  assert.match(sw, /sizingKind\(uiMode/)
  assert.match(sw, /readSignerSpendable/)
  assert.match(sw, /visibleSpend\(spendRaw/)
  assert.match(sw, /setAmt\(spend\.maxStr/)
  assert.doesNotMatch(sw, /spendableAmount\(held/)
  assert.doesNotMatch(sw, /live\.holdings/)
  assert.match(e, /balBlock/)
  assert.match(e, /overBal/)
  assert.match(e, /!canQuote \? \(routeNote \|\| 'No quote for this route'\)/)
  assert.match(e, /q\.err && !q\.q \? 'Live quote unavailable'/)
  assert.match(e, /q\.loading \? 'Waiting for a live quote'/)
  assert.match(e, /'No live quote yet · try again'/)
  assert.ok(e.indexOf('!q.q') < e.indexOf("q.loading ? 'Waiting"))
})
test('Swap never derives signing available from mock.assets; example MAX is labelled', () => {
  assert.doesNotMatch(sw, /assets\.map\(a => \(\{ sym: a\.sym/)
  assert.match(sw, /MAX · example/)
  assert.match(sw, /not a real spendable balance/)
  assert.match(sw, /watch-only addresses are not a signing balance/)
  assert.match(app, /preSignCheck/)
  assert.match(app, /estimateFee\(a, plan\.review\.account/)
})
