import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canUseExample, effectiveMode, EXAMPLE_REGISTERED, MAINNET_OFF, oriWalletCanSend, ORI_WALLET_RECEIVE_ONLY, payRoute, sessionKind, visibleHistory } from '../src/sessionMode.ts'

test('session kind: Gmail account or ORI wallet = registered, otherwise guest', () => {
  assert.equal(sessionKind({ account: null, nativeWallet: null }), 'guest')
  assert.equal(sessionKind({ account: { username: 'bamio' }, nativeWallet: null }), 'registered')
  assert.equal(sessionKind({ account: null, nativeWallet: { nearAccountId: 'abc' } }), 'registered')
})
test('registered sessions are locked to live data; guests can pick example', () => {
  assert.equal(effectiveMode('example', 'registered'), 'live')
  assert.equal(effectiveMode('example', 'guest'), 'example')
  assert.equal(effectiveMode('live', 'guest'), 'live')
  assert.equal(canUseExample('guest'), true); assert.equal(canUseExample('registered'), false)
})
test('registered history hides DEMO entries; guest history keeps them', () => {
  const list = [{ id: 'a', demo: true }, { id: 'b' }, { id: 'c', demo: false }]
  assert.deepEqual(visibleHistory(list, 'registered').map(t => t.id), ['b', 'c'])
  assert.equal(visibleHistory(list, 'guest').length, 3)
})
test('pay route: guest is always DEMO, even with settlement on', () => {
  assert.deepEqual(payRoute({ kind: 'guest', exampleHandle: false, settlementEnabled: true }), { route: 'demo' })
  assert.deepEqual(payRoute({ kind: 'guest', exampleHandle: true, settlementEnabled: false }), { route: 'demo' })
})
test('pay route: registered never gets a simulated success', () => {
  assert.deepEqual(payRoute({ kind: 'registered', exampleHandle: true, settlementEnabled: true }), { route: 'blocked', reason: EXAMPLE_REGISTERED })
  assert.deepEqual(payRoute({ kind: 'registered', exampleHandle: false, settlementEnabled: false }), { route: 'blocked', reason: MAINNET_OFF })
  assert.deepEqual(payRoute({ kind: 'registered', exampleHandle: false, settlementEnabled: true }), { route: 'live' })
  assert.match(MAINNET_OFF, /No funds were moved/)
})
test('ORI wallet is receive-only without a relayer, and the UI says so', () => {
  assert.equal(oriWalletCanSend(null), false); assert.equal(oriWalletCanSend('https://relayer.example'), true)
  assert.match(ORI_WALLET_RECEIVE_ONLY, /Receive-only/)
  const card = readFileSync(new URL('../src/NativeWallet.tsx', import.meta.url), 'utf8')
  assert.match(card, /ORI_WALLET_RECEIVE_ONLY/)
  assert.match(card, /RECEIVE-ONLY/)
})
test('App wires the guest/registered separation', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  for (const s of ['sessionKind(', 'effectiveMode(', 'payRoute(', 'visibleHistory']) assert.ok(app.includes(s) || readFileSync(new URL('../src/History.tsx', import.meta.url), 'utf8').includes(s), s)
})
