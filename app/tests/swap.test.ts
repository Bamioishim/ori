import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkSwapQuote, executeSwap, mapStatus, type SwapReview } from '../src/swapExec.ts'
import { findAsset, splInstructions, estimateFee, balanceOf, sendSpl, type Rpc } from '../src/transfers.ts'
const ME = '0x' + '11'.repeat(20), SOLME = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', SOLYOU = 'HPhokKWdcGDVTwEpzyLRUEAhMbwhsXAByqcUjjZsE8DT'
const DEP = '0x' + '33'.repeat(20)
const review: SwapReview = { originAsset: 'nep141:base-usdc', destinationAsset: 'nep141:sol.omft.near', units: 5_000_000n, recipient: SOLME, refundTo: ME, originNet: 'Base', account: ME, minOutUnits: 50_000_000n }
const now = Date.parse('2026-11-05T21:00:00Z')
const quote = (o: any = {}, r: any = {}) => ({ correlationId: 'c', timestamp: '', signature: '', quoteRequest: { originAsset: review.originAsset, destinationAsset: review.destinationAsset, recipient: SOLME, refundTo: ME, ...r }, quote: { depositAddress: DEP, amountIn: '5000000', amountOut: '56000000', minAmountOut: '55000000', amountInUsd: '5', amountOutUsd: '4.98', deadline: '2026-11-05T21:10:00Z', ...o } }) as any
test('quote bound to the review: route, amount, recipient, refund, fee/output, expiry, deposit format', () => {
  assert.equal(checkSwapQuote(quote(), review, now), null)
  assert.match(checkSwapQuote(quote({ amountIn: '5000001' }), review, now)!, /amount/)
  assert.match(checkSwapQuote(quote({}, { recipient: SOLYOU }), review, now)!, /recipient/)
  assert.match(checkSwapQuote(quote({}, { refundTo: '0x' + '44'.repeat(20) }), review, now)!, /refund/)
  assert.match(checkSwapQuote(quote({}, { destinationAsset: 'x' }), review, now)!, /route/)
  assert.match(checkSwapQuote(quote({ minAmountOut: '49000000' }), review, now)!, /price moved/)
  assert.match(checkSwapQuote(quote({ deadline: '2026-11-05T21:00:10Z' }), review, now)!, /expired/)
  assert.match(checkSwapQuote(quote({ deadline: undefined }), review, now)!, /expired/)
  assert.match(checkSwapQuote(quote({ depositAddress: SOLME }), review, now)!, /deposit address/)
  assert.match(checkSwapQuote(quote({ depositMemo: 'm' }), review, now)!, /memo/)
})
test('status mapping: only SUCCESS is complete', () => {
  assert.equal(mapStatus('SUCCESS'), 'complete'); assert.equal(mapStatus('REFUNDED'), 'refunded'); assert.equal(mapStatus('FAILED'), 'failed')
  for (const s of ['PENDING_DEPOSIT', 'KNOWN_DEPOSIT_TX', 'PROCESSING', 'INCOMPLETE_DEPOSIT', undefined] as const) assert.equal(mapStatus(s as any), 'pending')
})
const usdc = findAsset('USDC', 'Base')!
const base = (over: any = {}) => ({ quote: async () => quote(), limit: () => null, currentAccount: () => ME, deposit: async () => ({ hash: '0xh', explorer: '', status: 'confirmed' as const }), status: async () => ({ status: 'SUCCESS' }) as any, sleep: async () => {}, now: () => now, ...over })
test('executeSwap deposits exact amount to deposit address, completes only on provider SUCCESS', async () => {
  let got: any; const ups: string[] = []
  const r = await executeSwap(review, usdc, base({ deposit: async (_a: any, to: string, u: bigint) => { got = [to, u]; return { hash: '0xh', explorer: '', status: 'confirmed' } }, onUpdate: (s: string) => ups.push(s) }))
  assert.deepEqual(got, [DEP, 5_000_000n]); assert.equal(r.state, 'complete'); assert.deepEqual(ups, ['deposited', 'complete'])
})
test('executeSwap: pending stays pending, refund is reported, failed deposit is not complete', async () => {
  assert.equal((await executeSwap(review, usdc, base({ status: async () => ({ status: 'PROCESSING' }), polls: 3 }))).state, 'pending')
  assert.equal((await executeSwap(review, usdc, base({ status: async () => { throw new Error('down') }, polls: 2 }))).state, 'pending')
  assert.equal((await executeSwap(review, usdc, base({ status: async () => ({ status: 'REFUNDED' }) }))).state, 'refunded')
  assert.equal((await executeSwap(review, usdc, base({ deposit: async () => ({ hash: 'h', explorer: '', status: 'failed' }) }))).state, 'failed')
})
test('executeSwap: nothing deposited on mismatch, expiry, limit, account change, or wallet refusal', async () => {
  let deposits = 0; const dep = async () => { deposits++; return { hash: 'h', explorer: '', status: 'confirmed' as const } }
  await assert.rejects(executeSwap(review, usdc, base({ deposit: dep, quote: async () => quote({ amountIn: '1' }) })), /amount/)
  await assert.rejects(executeSwap(review, usdc, base({ deposit: dep, now: () => now + 3_600_000 })), /expired/)
  await assert.rejects(executeSwap(review, usdc, base({ deposit: dep, limit: () => 'Over your daily limit' })), /daily/)
  await assert.rejects(executeSwap(review, usdc, base({ deposit: dep, currentAccount: () => '0x' + '99'.repeat(20) })), /account changed/)
  assert.equal(deposits, 0)
  await assert.rejects(executeSwap(review, usdc, base({ deposit: async () => { throw new Error('User rejected the request.') } })), /rejected/)
})
// ---- SPL ----
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
test('SPL send uses the trusted mint + decimals via transferChecked, creates recipient ATA idempotently only when needed', async () => {
  const a = findAsset('USDC', 'Solana')!; assert.equal(a.token, USDC_MINT); assert.equal(a.decimals, 6)
  const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = await import('@solana/spl-token')
  const one = await splInstructions(a, SOLME, SOLYOU, 1_500_000n, false)
  assert.equal(one.ix.length, 1); const t = one.ix[0]
  assert.ok(t.programId.equals(TOKEN_PROGRAM_ID)); assert.equal(t.data[0], 12) // TransferChecked
  assert.equal(t.keys[1].pubkey.toBase58(), USDC_MINT); assert.equal(t.data.readBigUInt64LE(1), 1_500_000n); assert.equal(t.data[9], 6)
  const two = await splInstructions(a, SOLME, SOLYOU, 1n, true)
  assert.ok(two.ix[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)); assert.equal(two.ix[0].data[0], 1) // CreateIdempotent
  await assert.rejects(splInstructions(findAsset('SOL', 'Solana')!, SOLME, SOLYOU, 1n, false), /Not an SPL/)
})
const BH = { value: { blockhash: 'GHtXQBsoZHVnNFa9YevAzFr17DJjgHXk3ycTKD5xD3Zi', lastValidBlockHeight: 1 } }
const splRpc = (ataExists: boolean, extra: Record<string, any> = {}): Rpc => async (_u, m) => ({ getAccountInfo: { value: ataExists ? { data: [] } : null }, getLatestBlockhash: BH, getMinimumBalanceForRentExemption: 2039280, getFeeForMessage: { value: 5000 }, getBalance: { value: 10_000_000 }, getTokenAccountBalance: { value: { amount: '7000000' } }, ...extra } as any)[m]
test('SPL fee review includes ATA rent only when the recipient has no token account', async () => {
  const a = findAsset('USDT', 'Solana')!
  const f1 = await estimateFee(a, SOLME, SOLYOU, 1n, splRpc(false)); assert.equal(f1.feeUnits, 5000n + 2039280n); assert.match(f1.detail, /rent/)
  const f2 = await estimateFee(a, SOLME, SOLYOU, 1n, splRpc(true)); assert.equal(f2.feeUnits, 5000n)
  const b = await balanceOf(a, SOLME, splRpc(true)); assert.equal(b.asset, 7_000_000n); assert.equal(b.native, 10_000_000n)
})
test('SPL send: account change and wallet refusal send nothing; confirmation polled', async () => {
  const a = findAsset('USDC', 'Solana')!
  await assert.rejects(sendSpl({ publicKey: { toString: () => SOLYOU }, signAndSendTransaction: async () => ({ signature: 's' }) } as any, a, SOLME, SOLYOU, 1n, splRpc(true)), /account changed/)
  await assert.rejects(sendSpl({ publicKey: { toString: () => SOLME }, signAndSendTransaction: async () => { throw new Error('User rejected') } } as any, a, SOLME, SOLYOU, 1n, splRpc(true)), /rejected/)
  const r = await sendSpl({ publicKey: { toString: () => SOLME }, signAndSendTransaction: async () => ({ signature: 'sig' }) } as any, a, SOLME, SOLYOU, 1n, splRpc(true, { getSignatureStatuses: { value: [{ confirmationStatus: 'confirmed', err: null }] } }), 0, 2)
  assert.equal(r.status, 'confirmed')
})
