import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { receiveTargets } from '../src/receiveTargets.ts'
const kindOf = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a) ? 'evm' as const : /\.near$/.test(a) ? 'near' as const : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? 'sol' as const : null
const EVM = '0x' + 'ab'.repeat(20), SOL = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
test('connected wallets map to their real networks', () => {
  const t = receiveTargets([{ address: EVM, chain: 'evm', label: 'MetaMask' }, { address: SOL, chain: 'sol' }], [], kindOf)
  assert.deepEqual(t.map(x => [x.kind, x.networks]), [['evm', ['Base', 'Ethereum']], ['sol', ['Solana']]])
})
test('no wallets -> no addresses (never demo data)', () => assert.deepEqual(receiveTargets([], [], kindOf), []))
test('dedupes, ignores invalid addresses', () => {
  const t = receiveTargets([{ address: EVM, chain: 'evm' }], [EVM.toUpperCase().replace('0X', '0x'), 'not-an-address', 'bob.near'], kindOf)
  assert.equal(t.length, 2); assert.equal(t[1].kind, 'near'); assert.equal(t[1].source, 'watched')
})
test('Home: Pay tile is Receive and the demo EVM address is gone', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), rec = readFileSync(new URL('../src/Receive.tsx', import.meta.url), 'utf8')
  assert.match(app, /\['Receive', 'receive', \(\) => go\('receive'\)/); assert.doesNotMatch(app, /\['Pay', 'pay', \(\) => go\('pay', '@tolu'/)
  assert.doesNotMatch(app, /0x7094b3c1e2f0a9d8c4b2e1f6a3d5c7e9b1f42242/); assert.doesNotMatch(rec, /PREVIEW|mock|0x7094/)
  assert.match(app, /<ProfileChip /); assert.match(rec, /preferredReceivingCurrency/)
})
test('logout keeps wallets and keeps the profile for code sign-in on this device', () => {
  const acc = readFileSync(new URL('../src/session.ts', import.meta.url), 'utf8') + readFileSync(new URL('../src/Account.tsx', import.meta.url), 'utf8')
  const so = acc.slice(acc.indexOf('export function signOut'), acc.indexOf('\n', acc.indexOf('export function signOut')))
  assert.doesNotMatch(so, /ori-external-wallets|ori-active-wallet|ori-transactions|clear\(\)/)
  assert.match(so, /ori-known-profiles|KNOWN/); assert.match(acc, /storedAccount\(j\.email\)/)
})
