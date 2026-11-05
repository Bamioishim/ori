import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sendEvm, findAsset, solRecipientCheck, checkRpcChain, type Rpc } from '../src/transfers.ts'
const ME = '0x' + '11'.repeat(20), YOU = '0x' + '22'.repeat(20)
test('EVM: aborts if the wallet is still on the wrong chain after switch (no signature)', async () => {
  let signed = false; const p = { request: async (a: any) => { if (a.method === 'eth_sendTransaction') signed = true; return a.method === 'eth_chainId' ? '0x1' : a.method === 'eth_requestAccounts' ? [ME] : null } }
  await assert.rejects(sendEvm(p, findAsset('ETH', 'Base')!, ME, YOU, 1n, async () => null, 0, 1), /not on Base/); assert.equal(signed, false)
})
test('EVM: wallet rejection propagates (no fake success)', async () => {
  const p = { request: async (a: any) => { if (a.method === 'eth_sendTransaction') throw Object.assign(new Error('User rejected'), { code: 4001 }); return a.method === 'eth_chainId' ? '0x2105' : [ME] } }
  await assert.rejects(sendEvm(p, findAsset('ETH', 'Base')!, ME, YOU, 1n, async () => null, 0, 1), /rejected/)
})
test('RPC must report the expected chain id', async () => { assert.equal(await checkRpcChain('Base', async () => '0x2105'), null); assert.ok(await checkRpcChain('Base', async () => '0x1')) })
test('Solana rent: new account below rent-exempt minimum is blocked', async () => {
  const rpc = (bal: number): Rpc => async (_u, m) => m === 'getBalance' ? { value: bal } : 890880
  assert.match((await solRecipientCheck('So11111111111111111111111111111111111111112', 1000n, rpc(0)))!, /rent-exempt/)
  assert.equal(await solRecipientCheck('So11111111111111111111111111111111111111112', 1000n, rpc(5)), null)
  assert.equal(await solRecipientCheck('So11111111111111111111111111111111111111112', 890880n, rpc(0)), null)
})
test('Send: rejected/failed-before-broadcast history entry becomes cancelled', () => {
  const s = readFileSync(new URL('../src/Send.tsx', import.meta.url), 'utf8'); assert.match(s, /updateTransaction\(txId, \{ status: 'cancelled'/)
  const sign = s.slice(s.indexOf('const sign = async')); assert.ok(sign.indexOf('checkRpcChain') < sign.indexOf('sendEvm('))
})
test('Live Intents deposit is bound to the reviewed quote and uses exact units', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'), live = readFileSync(new URL('../src/live.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(app, /Math\.round\(amt \* 1e6\)/); assert.doesNotMatch(live, /eth_sendTransaction/) // all Base signing goes through sendEvm (behavior tested in pay.test.ts)
})
test('no user-controlled provider URL (SSRF): 1Click host is a constant', () => {
  const api = ['api/_oneclick.ts', 'api/quote.ts', 'api/status.ts'].map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n')
  assert.match(api, /const ONECLICK = 'https:\/\/1click\.chaindefuser\.com\/v0'/); assert.doesNotMatch(api, /fetch\((?!ONECLICK)[a-z]/i)
})
