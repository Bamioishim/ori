import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isExampleHandle } from '../src/handles.ts'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const pay = app.slice(app.indexOf('function Pay('), app.indexOf('function LiveTag('))
const confirm = app.slice(app.indexOf('const confirm = async'), app.indexOf('const confirmSwap'))
const doPay = app.slice(app.indexOf('const doPay = async'), app.indexOf('const swapInFlight'))

test('DEMO @tolu allowed even when settlement env is live — no ORI_HANDLE_DIRECTORY deadend CTA', () => {
  assert.doesNotMatch(pay, /ORI_HANDLE_DIRECTORY to pay for real/)
  assert.doesNotMatch(pay, /isSettlementEnabled\(\) && resolvedExample/)
  assert.match(pay, /review DEMO payment/)
  assert.match(confirm, /DEMO · simulated/)
  assert.match(confirm, /isExampleHandle/)
})

test('demo execution: no createSettlementQuote / connectBaseWallet / fake explorer in demo branch', () => {
  assert.match(doPay, /demo: true/)
  assert.match(doPay, /DEMO · simulated delivery/)
  assert.match(doPay, /Nothing was signed/)
  // live path still has explorer; demo note must not invent txHash
  const demoChunk = doPay.slice(0, doPay.indexOf('if (!plan || plan.usd'))
  assert.doesNotMatch(demoChunk, /txHash:/)
  assert.doesNotMatch(demoChunk, /basescan\.org/)
  assert.doesNotMatch(demoChunk, /createSettlementQuote/)
  assert.doesNotMatch(demoChunk, /connectBaseWallet/)
  assert.doesNotMatch(demoChunk, /addSpent\(/) // real spending ledger not charged
})

test('mode switch aborts pending review sheet', () => {
  assert.match(app, /sheetAction\.current = 'cancel'/)
  assert.match(app, /setSheet\(null\)/)
  const setMode = app.slice(app.indexOf('const setMode = (m: Mode)'), app.indexOf('const [draft, setDraft]'))
  assert.match(setMode, /setSheet\(null\)/)
  assert.match(setMode, /paymentInFlight\.current = false/)
})

test('service errors never labelled as recipient; quotes clear on resolveError', () => {
  assert.match(pay, /resolveKind === 'service'/)
  assert.match(pay, /canQuotePay/)
  assert.match(pay, /!resolveError/)
  assert.doesNotMatch(pay, /Handle unresolved: \$\{resolveError\}.*ORI service/)
})

test('repeated confirm guarded by paymentInFlight', () => {
  assert.match(doPay, /if \(paymentInFlight\.current\) return/)
})

test('isExampleHandle covers @tolu/@ade only', () => {
  assert.equal(isExampleHandle('@tolu'), true)
  assert.equal(isExampleHandle('@ade'), true)
  assert.equal(isExampleHandle('@nobody'), false)
})

test('mode-change invalidates in-flight DEMO so stale celebrate cannot log', () => {
  assert.match(app, /demoPayGen/)
  assert.match(app, /demoPayGen\.current \+= 1/)
  assert.match(doPay, /gen !== demoPayGen\.current/)
  assert.match(doPay, /stale \/ cancelled/)
  assert.match(doPay, /if \(gen === demoPayGen\.current\) setStatus/)
})
