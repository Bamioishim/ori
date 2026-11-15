import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { canUseExample, effectiveMode, EXAMPLE_REGISTERED, GUEST_ONLY, MAINNET_OFF, oriWalletCanSend, ORI_WALLET_RECEIVE_ONLY, payRoute, sessionKind, visibleHistory } from '../src/sessionMode.ts'

test('public preview supports guest and authenticated ORI wallet sessions', () => {
  assert.equal(GUEST_ONLY, false)
  assert.equal(sessionKind({ account: null, nativeWallet: null }), 'guest')
  assert.equal(sessionKind({ account: { username: 'bamio' }, nativeWallet: null }), 'registered')
  assert.equal(sessionKind({ account: null, nativeWallet: { nearAccountId: 'abc' } }), 'registered')
})
test('registered sessions use live data; guests can pick example', () => {
  assert.equal(effectiveMode('example', 'guest'), 'example')
  assert.equal(effectiveMode('live', 'guest'), 'live')
  assert.equal(effectiveMode('example', 'registered'), 'live')
  assert.equal(canUseExample('guest'), true)
  assert.equal(canUseExample('registered'), false)
})
test('registered history hides DEMO entries while guest history keeps them', () => {
  const list = [{ id: 'a', demo: true }, { id: 'b' }, { id: 'c', demo: false }]
  assert.equal(visibleHistory(list, 'guest').length, 3)
  assert.deepEqual(visibleHistory(list, 'registered').map(x => x.id), ['b', 'c'])
})
test('pay route: guest is DEMO; registered sessions fail closed without live settlement', () => {
  assert.deepEqual(payRoute({ kind: 'guest', exampleHandle: false, settlementEnabled: true }), { route: 'demo' })
  assert.deepEqual(payRoute({ kind: 'registered', exampleHandle: true, settlementEnabled: true }), { route: 'blocked', reason: EXAMPLE_REGISTERED })
  assert.deepEqual(payRoute({ kind: 'registered', exampleHandle: false, settlementEnabled: false }), { route: 'blocked', reason: MAINNET_OFF })
  assert.deepEqual(payRoute({ kind: 'registered', exampleHandle: false, settlementEnabled: true }), { route: 'live' })
})
test('ORI wallet is receive-only without a relayer, and the UI says so', () => {
  assert.equal(oriWalletCanSend(null), false)
  assert.equal(oriWalletCanSend('https://relayer.example'), true)
  assert.match(ORI_WALLET_RECEIVE_ONLY, /Receive-only/)
  const card = readFileSync(new URL('../src/NativeWallet.tsx', import.meta.url), 'utf8')
  assert.match(card, /ORI_WALLET_RECEIVE_ONLY/)
  assert.match(card, /RECEIVE-ONLY/)
})
test('App wires guest/registered separation and the native wallet entry point', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  for (const s of ['sessionKind(', 'effectiveMode(', 'payRoute(', 'visibleHistory']) assert.ok(app.includes(s) || readFileSync(new URL('../src/History.tsx', import.meta.url), 'utf8').includes(s), s)
  for (const file of ['Send.tsx', 'Account.tsx', 'NativeWallet.tsx']) assert.match(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), /GUEST_ONLY/)
  assert.match(readFileSync(new URL('../src/Wallets.tsx', import.meta.url), 'utf8'), /NativeWalletCard/)
  assert.doesNotMatch(readFileSync(new URL('../src/Wallets.tsx', import.meta.url), 'utf8'), /MetaMask|Phantom|connectWallet/)
})
