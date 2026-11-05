import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  amountAllowed, canUseMax, exampleSpendable, pickSigner, readSignerSpendable,
  signerSpendable, sizingKind, spendSourceKey, unknownSpend,
} from '../src/spendableBalance.ts'
import { gasReserve } from '../src/uiLogic.ts'
import type { AssetDef, Rpc } from '../src/transfers.ts'

test('sizingKind: example mock only when UI example AND settlement off', () => {
  assert.equal(sizingKind('example', false), 'example')
  assert.equal(sizingKind('example', true), 'signer')
  assert.equal(sizingKind('live', false), 'signer')
  assert.equal(sizingKind('live', true), 'signer')
})

test('exampleSpendable labels example-only and never claims live spendable', () => {
  const s = exampleSpendable('SOL', 'sol')
  assert.equal(s.kind, 'example')
  assert.ok(s.amount != null && s.amount === 4.1 - gasReserve('SOL', 'sol'))
  assert.match(s.label, /example/i)
  assert.match(s.label, /not spendable/i)
  assert.equal(s.owner, null)
  const miss = exampleSpendable('WIF', 'sol')
  assert.equal(miss.amount, null)
  assert.equal(canUseMax(miss), false)
  assert.equal(canUseMax(s), true)
})

test('pickSigner prefers active wallet on the matching chain; ignores other chains', () => {
  const ws = [
    { id: 'e1', chain: 'evm' as const, address: '0xaaa' },
    { id: 's1', chain: 'sol' as const, address: 'SolAAA' },
    { id: 'e2', chain: 'evm' as const, address: '0xbbb' },
  ]
  assert.equal(pickSigner(ws, 'e2', 'base'), '0xbbb')
  assert.equal(pickSigner(ws, 'e2', 'sol'), 'SolAAA') // active is evm; fall back to sol wallet
  assert.equal(pickSigner(ws, 's1', 'sol'), 'SolAAA')
  assert.equal(pickSigner(ws, null, 'near'), null)
  assert.equal(pickSigner([], 'x', 'base'), null)
})

test('watch-only / unrelated address is not used: only wallets list (signer) can size', () => {
  // No API takes a watch address — pickSigner only sees managed wallets.
  assert.equal(pickSigner([], null, 'base'), null)
  const u = unknownSpend('no wallet')
  assert.equal(amountAllowed(u, 1, 'USDC'), 'no wallet')
  assert.equal(canUseMax(u), false)
})

test('amountAllowed: loading/error/no wallet / over balance / example over', () => {
  assert.equal(amountAllowed(unknownSpend('Reading…'), 0), 'Enter an amount')
  assert.match(amountAllowed(unknownSpend('Reading…'), 5)!, /Reading/)
  const stale = { ...signerSpendable({ asset: { sym: 'USDC', net: 'Base', decimals: 6, kind: 'erc20', token: '0x1' }, owner: '0xabc', bal: { asset: 5_000_000n, native: 10n ** 18n }, fee: { feeUnits: 1n, feeSym: 'ETH', feeDecimals: 18, detail: 'x' } }), fresh: false }
  assert.match(amountAllowed(stale, 1)!, /stale/)
  const ok = signerSpendable({ asset: { sym: 'USDC', net: 'Base', decimals: 6, kind: 'erc20', token: '0x1' }, owner: '0xabc', bal: { asset: 5_000_000n, native: 10n ** 18n }, fee: { feeUnits: 1n, feeSym: 'ETH', feeDecimals: 18, detail: 'x' } })
  assert.equal(ok.amount, 5)
  assert.equal(amountAllowed(ok, 4), null)
  assert.match(amountAllowed(ok, 6)!, /signing wallet/)
  const ex = exampleSpendable('USDC', 'base')
  assert.match(amountAllowed(ex, ex.amount! + 1)!, /example data/)
  assert.equal(amountAllowed(ex, ex.amount! - 1), null)
})

test('native without fee estimate → unknown (no guessed reserve for live)', () => {
  const a: AssetDef = { sym: 'ETH', net: 'Ethereum', decimals: 18, kind: 'native' }
  const st = signerSpendable({ asset: a, owner: '0xabc', bal: { asset: 10n ** 18n, native: 10n ** 18n }, fee: null, feeErr: 'rpc down' })
  assert.equal(st.kind, 'unknown')
  assert.match(st.reason!, /rpc down|unavailable/i)
  assert.equal(canUseMax(st), false)
})

test('token with insufficient native gas → zero spendable with reason', () => {
  const a: AssetDef = { sym: 'USDC', net: 'Base', decimals: 6, kind: 'erc20', token: '0x1' }
  const st = signerSpendable({ asset: a, owner: '0xabc', bal: { asset: 100_000_000n, native: 10n }, fee: { feeUnits: 1000n, feeSym: 'ETH', feeDecimals: 18, detail: 'gas' } })
  assert.equal(st.kind, 'signer')
  assert.equal(st.amount, 0)
  assert.match(st.reason!, /Not enough ETH/)
})

test('source key changes when owner/token changes (freshness race)', () => {
  const a: AssetDef = { sym: 'USDC', net: 'Base', decimals: 6, kind: 'erc20', token: '0x1' }
  const k1 = spendSourceKey('0xaaa', a)
  const k2 = spendSourceKey('0xbbb', a)
  const k3 = spendSourceKey('0xaaa', { ...a, token: '0x2' })
  assert.notEqual(k1, k2)
  assert.notEqual(k1, k3)
})

test('readSignerSpendable uses balanceOf + estimateFee; fails closed on balance error', async () => {
  const a: AssetDef = { sym: 'ETH', net: 'Ethereum', decimals: 18, kind: 'native' }
  const rpc: Rpc = async (_url, method) => {
    if (method === 'eth_getBalance') return '0x' + (10n ** 18n).toString(16)
    if (method === 'eth_estimateGas') return '0x5208'
    if (method === 'eth_gasPrice') return '0x' + (10n ** 9n).toString(16)
    throw new Error('unexpected ' + method)
  }
  const st = await readSignerSpendable(a, '0x0000000000000000000000000000000000000001', 10n ** 15n, rpc)
  assert.equal(st.kind, 'signer')
  assert.ok(st.fresh && st.amount != null && st.amount < 1)
  assert.match(st.feeNote || '', /approx/i)

  const boom: Rpc = async () => { throw new Error('RPC exploded') }
  const bad = await readSignerSpendable(a, '0x0000000000000000000000000000000000000001', 1n, boom)
  assert.equal(bad.kind, 'unknown')
  assert.match(bad.reason!, /RPC exploded|Fee estimate|Balance/)
})

test('mock-live isolation: example amounts must not equal a forged live signer state', () => {
  const ex = exampleSpendable('SOL', 'sol')
  const live = unknownSpend('no wallet')
  assert.equal(ex.kind, 'example')
  assert.equal(live.kind, 'unknown')
  assert.notEqual(ex.label, live.label)
  assert.equal(canUseMax(live), false)
})
