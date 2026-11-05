import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findAsset, validateRecipient, toUnits, fromUnits, evmTxFor, estimateFee, preSignCheck, sendEvm, sendSol, unsupportedReason, type Rpc } from '../src/transfers.ts'
const ME = '0x' + '11'.repeat(20), YOU = '0x' + '22'.repeat(20)
const SOL_ME = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', SOL_YOU = 'So11111111111111111111111111111111111111112'
const caps = { perPay: 250, daily: 500 }
test('address validation is network-aware', () => {
  assert.equal(validateRecipient('Base', YOU), null); assert.ok(validateRecipient('Base', SOL_ME)); assert.ok(validateRecipient('Base', '0x' + '0'.repeat(40)))
  assert.equal(validateRecipient('Solana', SOL_YOU), null); assert.ok(validateRecipient('Solana', YOU)); assert.ok(validateRecipient('Ethereum', ''))
})
test('exact unit conversion', () => {
  assert.equal(toUnits('1.5', 6), 1500000n); assert.equal(toUnits('0.000001', 6), 1n); assert.equal(toUnits('0.0000001', 6), null); assert.equal(toUnits('0', 6), null); assert.equal(toUnits('1e3', 6), null)
  assert.equal(fromUnits(1500000n, 6), '1.5'); assert.equal(toUnits('0.1', 18), 100000000000000000n)
})
test('same-chain transfers are direct (native value / ERC-20 transfer), never an Intents deposit', () => {
  const eth = evmTxFor(findAsset('ETH', 'Base')!, ME, YOU, 10n); assert.equal(eth.to, YOU); assert.equal(eth.value, '0xa'); assert.equal(eth.data, undefined)
  const usdc = evmTxFor(findAsset('USDC', 'Ethereum')!, ME, YOU, 5n); assert.equal(usdc.to, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'); assert.ok(usdc.data!.startsWith('0xa9059cbb' + '0'.repeat(24) + '22'.repeat(20)))
})
test('NEAR and unknown assets are explicitly unsupported (no fake success)', () => {
  assert.match(unsupportedReason(findAsset('NEAR', 'NEAR'))!, /no NEAR wallet connector/); assert.ok(unsupportedReason(findAsset('USDT', 'Solana')))
  assert.throws(() => evmTxFor(findAsset('NEAR', 'NEAR')!, ME, YOU, 1n))
})
test('EVM fee estimate comes from chain RPC (gas × gasPrice)', async () => {
  const rpc: Rpc = async (_u, m) => m === 'eth_estimateGas' ? '0x5208' : m === 'eth_gasPrice' ? '0x3b9aca00' : null
  const f = await estimateFee(findAsset('ETH', 'Ethereum')!, ME, YOU, 1n, rpc); assert.equal(f.feeUnits, 21000n * 1000000000n); assert.equal(f.feeSym, 'ETH')
})
test('Solana fee estimate uses getFeeForMessage', async () => {
  const rpc: Rpc = async (_u, m) => m === 'getLatestBlockhash' ? { value: { blockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k' } } : m === 'getFeeForMessage' ? { value: 5000 } : null
  assert.equal((await estimateFee(findAsset('SOL', 'Solana')!, SOL_ME, SOL_YOU, 1000n, rpc)).feeUnits, 5000n)
})
const fee = { feeUnits: 100n, feeSym: 'ETH', feeDecimals: 18, detail: '' }
test('pre-sign gate: balance + fee + caps + recipient, fail-closed', () => {
  const eth = findAsset('ETH', 'Base')!, usdc = findAsset('USDC', 'Base')!
  assert.equal(preSignCheck({ a: eth, units: 900n, fee, bal: { asset: 1000n, native: 1000n }, usd: 10, caps, spent: 0, recipientError: null }), null)
  assert.match(preSignCheck({ a: eth, units: 950n, fee, bal: { asset: 1000n, native: 1000n }, usd: 10, caps, spent: 0, recipientError: null })!, /amount plus the network fee/)
  assert.match(preSignCheck({ a: usdc, units: 5n, fee, bal: { asset: 5n, native: 10n }, usd: 5, caps, spent: 0, recipientError: null })!, /network fee/)
  assert.match(preSignCheck({ a: usdc, units: 5n, fee, bal: { asset: 5n, native: 1000n }, usd: 300, caps, spent: 0, recipientError: null })!, /per-payment cap/)
  assert.ok(preSignCheck({ a: usdc, units: 5n, fee, bal: { asset: 5n, native: 1000n }, usd: 0, caps, spent: 0, recipientError: null }))
  assert.ok(preSignCheck({ a: usdc, units: 5n, fee, bal: { asset: 5n, native: 1000n }, usd: 5, caps, spent: 0, recipientError: 'bad' }))
})
test('mocked EVM wallet: switches chain, sends direct tx, confirms only on receipt status 0x1', async () => {
  const calls: any[] = []; const p = { request: async (a: any) => { calls.push(a); return a.method === 'eth_chainId' ? '0x1' : a.method === 'eth_requestAccounts' ? [ME] : a.method === 'eth_sendTransaction' ? '0xhash' : null } }
  let n = 0; const rpc: Rpc = async (_u, m) => m === 'eth_getTransactionReceipt' ? (++n < 2 ? null : { status: '0x1' }) : null
  const r = await sendEvm(p, findAsset('USDC', 'Base')!, ME, YOU, 7n, rpc, 0, 5)
  assert.equal(r.status, 'confirmed'); assert.match(r.explorer, /basescan/)
  assert.ok(calls.some(c => c.method === 'wallet_switchEthereumChain' && c.params[0].chainId === '0x2105'))
  const sent = calls.find(c => c.method === 'eth_sendTransaction').params[0]; assert.equal(sent.to, '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
  const failed = await sendEvm(p, findAsset('ETH', 'Base')!, ME, YOU, 7n, async () => ({ status: '0x0' }), 0, 2); assert.equal(failed.status, 'failed')
  const pending = await sendEvm(p, findAsset('ETH', 'Base')!, ME, YOU, 7n, async () => null, 0, 2); assert.equal(pending.status, 'pending')
})
test('mocked EVM wallet: account mismatch aborts before signing', async () => {
  let signed = false; const p = { request: async (a: any) => { if (a.method === 'eth_sendTransaction') signed = true; return a.method === 'eth_chainId' ? '0x2105' : a.method === 'eth_requestAccounts' ? [YOU] : null } }
  await assert.rejects(sendEvm(p, findAsset('ETH', 'Base')!, ME, YOU, 1n, async () => null, 0, 1)); assert.equal(signed, false)
})
test('mocked Solana wallet: builds SystemProgram transfer, confirms via signature status', async () => {
  let tx: any; const p = { publicKey: { toString: () => SOL_ME }, signAndSendTransaction: async (t: any) => { tx = t; return { signature: 'sig1' } } }
  const rpc: Rpc = async (_u, m) => m === 'getLatestBlockhash' ? { value: { blockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k' } } : m === 'getSignatureStatuses' ? { value: [{ err: null, confirmationStatus: 'confirmed' }] } : null
  const r = await sendSol(p, SOL_ME, SOL_YOU, 1234n, rpc, 0, 2)
  assert.equal(r.status, 'confirmed'); assert.equal(tx.instructions.length, 1); assert.equal(tx.instructions[0].programId.toBase58(), '11111111111111111111111111111111')
  await assert.rejects(sendSol({ ...p, publicKey: { toString: () => SOL_YOU } }, SOL_ME, SOL_YOU, 1n, rpc, 0, 1))
})
import { readFileSync } from 'node:fs'
test('Send screen: balance+cap gate runs before any wallet signature; no Intents in same-chain send', () => {
  const s = readFileSync(new URL('../src/Send.tsx', import.meta.url), 'utf8'), sign = s.slice(s.indexOf('const sign = async'))
  const g = sign.indexOf('preSignCheck('), e = sign.indexOf('sendEvm('), so = sign.indexOf('sendSol(')
  assert.ok(g > 0 && g < e && g < so); assert.doesNotMatch(s, /createSettlementQuote|oneclick|1click/i)
})
