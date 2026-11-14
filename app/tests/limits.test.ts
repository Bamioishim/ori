import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { decideLimit } from '../src/limits.ts'
const caps = { perPay: 250, daily: 500 }
test('within limits passes', () => { assert.equal(decideLimit(caps, 50, 0), null); assert.equal(decideLimit(caps, 250, 250), null) })
test('over per-payment cap blocks', () => assert.match(decideLimit(caps, 251, 0)!, /per-payment cap/))
test('over daily cap blocks', () => assert.match(decideLimit(caps, 100, 450)!, /daily cap/))
test('fail-closed on invalid amount', () => { for (const a of [NaN, -1, 0, Infinity]) assert.ok(decideLimit(caps, a, 0)) })
test('fail-closed on tampered caps (localStorage edits)', () => {
  for (const c of [{ perPay: NaN, daily: 500 }, { perPay: '1e9' as any, daily: 500 }, { perPay: 250, daily: -1 }, { perPay: undefined as any, daily: 500 }]) assert.ok(decideLimit(c, 10, 0))
})
test('fail-closed on corrupt spend ledger', () => { assert.ok(decideLimit(caps, 10, NaN)); assert.ok(decideLimit(caps, 10, -100)) })
test('KNOWN LIMITATION: raising caps in localStorage to huge valid numbers is accepted (client-side only)', () => {
  assert.equal(decideLimit({ perPay: 1e12, daily: 1e12 }, 1e6, 0), null)
})
// Mocked signing paths: simulate the doPay/doSwap gate with a fake wallet signer; nothing real is signed.
function gate(capsIn: typeof caps, amt: number, spent: number, sign: () => string) { const why = decideLimit(capsIn, amt, spent); return why ? { blocked: why } : { tx: sign() } }
test('mock signer is never invoked when over limit', () => {
  let calls = 0; const sign = () => { calls++; return '0xmock' }
  assert.ok('blocked' in gate(caps, 999, 0, sign)); assert.equal(calls, 0)
  assert.equal((gate(caps, 10, 0, sign) as any).tx, '0xmock'); assert.equal(calls, 1)
})
test('signing boundary re-checks limits in doPay and doSwap before any wallet call', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const pay = app.slice(app.indexOf('const doPay ='), app.indexOf('const doSwap ='))
  const iLimit = pay.indexOf('limitCheck(cfg, amt)'), iWallet = pay.indexOf('executePay('), iSim = pay.indexOf('celebrate(')
  assert.ok(iLimit > 0 && iLimit < iWallet && iLimit < iSim, 'limit check precedes wallet connect and simulation')
  const swap = app.slice(app.indexOf('const doSwap ='), app.indexOf('const overLimit ='))
  assert.ok(swap.indexOf('limitCheck(cfg, v)') > 0 && swap.indexOf('limitCheck(cfg, v)') < swap.indexOf('celebrate('))
})
test('backend has no limit check (documented bypass): /api/quote never reads caps', () => {
  const api = readFileSync(new URL('../api/quote.ts', import.meta.url), 'utf8') + readFileSync(new URL('../api/_oneclick.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(api, /perPay|daily|limit/i)
})
test('UI copy does not claim on-chain or unbypassable enforcement', () => {
  const ui = ['src/Screens.tsx', 'src/Policy.tsx', 'src/brain.ts'].map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n')
  assert.doesNotMatch(ui, /LIMITS · ENFORCED|ENFORCED BY ORI|caps are enforced|blocked outright/)
  assert.match(ui, /do not govern your external wallet/)
})
