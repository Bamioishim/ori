import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) }
const { preparePay, executePay, BASE_USDC_ID, SOL_USDC_ID } = await import('../src/payExec.ts')
const { reserveSpend, releaseSpend, addSpent, spentToday } = await import('../src/settings.ts')
const { sendEvm, findAsset } = await import('../src/transfers.ts')
beforeEach(() => mem.clear())
const ME = '0x' + '11'.repeat(20), EVM_TO = '0x' + '22'.repeat(20), SOL_TO = 'HPhokKWdcGDVTwEpzyLRUEAhMbwhsXAByqcUjjZsE8DT', DEP = '0x' + '33'.repeat(20)
const NOW = Date.parse('2026-11-05T21:00:00Z')
const q = (o: any = {}, r: any = {}) => ({ correlationId: 'c', timestamp: '', signature: '', quoteRequest: { originAsset: BASE_USDC_ID, destinationAsset: SOL_USDC_ID, recipient: SOL_TO, refundTo: ME, ...r }, quote: { depositAddress: DEP, amountIn: '5000000', amountOut: '4990000', minAmountOut: '4950000', deadline: '2026-11-05T21:10:00Z', ...o } }) as any
const prep = (quote = async () => q()) => preparePay(5, SOL_TO, { resolve: async () => { throw new Error('no') }, connect: async () => ME, quote, now: () => NOW })

test('(1)(2) review builds one bound plan: route, amount, recipient, refund, min-out, deadline', async () => {
  const p = await prep(); assert.equal(p.kind, 'intents')
  if (p.kind !== 'intents') return
  assert.equal(p.review.units, 5_000_000n); assert.equal(p.review.minOutUnits, 4_950_000n); assert.equal(p.review.refundTo, ME); assert.equal(p.review.recipient, SOL_TO)
  await assert.rejects(prep(async () => q({}, { recipient: SOL_TO.replace('H', 'J') })), /recipient/)
  await assert.rejects(prep(async () => q({}, { refundTo: EVM_TO })), /refund/)
  await assert.rejects(prep(async () => q({}, { destinationAsset: 'nep141:evil' })), /route/)
  await assert.rejects(prep(async () => q({ amountIn: '4999999' })), /amount/)
  await assert.rejects(prep(async () => q({ deadline: undefined })), /expired/)
  await assert.rejects(prep(async () => q({ deadline: '2026-11-05T21:00:20Z' })), /expired/)
  await assert.rejects(prep(async () => q({ depositMemo: 'x' })), /memo/)
  await assert.rejects(prep(async () => q({ minAmountOut: undefined })), /minimum output/)
  const d = await preparePay(5, EVM_TO, { resolve: async () => { throw new Error('x') }, connect: async () => ME, quote: async () => { throw new Error('must not quote') } })
  assert.equal(d.kind, 'direct')
})
// mock EIP-1193 wallet + RPC
function wallet(o: { chain?: string; switchTo?: string | null; accounts?: string[]; refuse?: boolean } = {}) {
  let chain = o.chain ?? '0x2105'; const calls: string[] = []
  const p = { calls, request: async ({ method, params }: any) => { calls.push(method)
    if (method === 'eth_chainId') return chain
    if (method === 'wallet_switchEthereumChain') { if (o.switchTo !== null) chain = o.switchTo ?? params[0].chainId; return null }
    if (method === 'eth_requestAccounts') return o.accounts ?? [ME]
    if (method === 'eth_sendTransaction') { if (o.refuse) throw new Error('User rejected the request.'); return '0xhash' }
  } }
  return p
}
const rpc = (status: string | null) => async (_u: string, m: string) => m === 'eth_getTransactionReceipt' ? (status ? { status } : null) : null
const sendWith = (receipt: string | null) => ((p: any, a: any, f: string, t: string, u: bigint) => sendEvm(p, a, f, t, u, rpc(receipt) as any, 0, 2)) as any
const deps = (p: any, o: any = {}) => ({ provider: p, limit: () => null, status: async () => ({ status: 'SUCCESS' }) as any, reserve: reserveSpend, release: releaseSpend, send: sendWith('0x1'), sleep: async () => {}, polls: 3, now: () => NOW, ...o })
const signed = (p: any) => p.calls.filter((c: string) => c === 'eth_sendTransaction').length

test('(4) wrong chain after switch, or account changed → signer never invoked', async () => {
  const plan = await prep()
  const w1 = wallet({ chain: '0x1', switchTo: null }); await assert.rejects(executePay(plan, 'a', deps(w1)), /not on Base/); assert.equal(signed(w1), 0)
  const w2 = wallet({ accounts: [EVM_TO] }); await assert.rejects(executePay(plan, 'b', deps(w2)), /account changed/); assert.equal(signed(w2), 0)
  const w3 = wallet({ chain: '0x1' }); assert.equal((await executePay(plan, 'c', deps(w3))).state, 'complete'); assert.deepEqual(w3.calls.slice(0, 3), ['eth_chainId', 'wallet_switchEthereumChain', 'eth_chainId'])
})
test('(2) refusal, limit, expiry at execution → nothing sent, nothing reserved', async () => {
  const plan = await prep()
  const w = wallet({ refuse: true }); await assert.rejects(executePay(plan, 'r', deps(w)), /rejected/); assert.equal(spentToday(), 0)
  const w2 = wallet(); await assert.rejects(executePay(plan, 'l', deps(w2, { limit: () => 'Over daily limit' })), /daily/); assert.equal(signed(w2), 0)
  const w3 = wallet(); await assert.rejects(executePay(plan, 'e', deps(w3, { now: () => NOW + 3_600_000 })), /expired/); assert.equal(signed(w3), 0); assert.equal(spentToday(), 0)
})
test('(3) REFUNDED is terminal "refunded" and releases only its own hold, idempotently', async () => {
  addSpent(20) // some other spend
  const plan = await prep(); const ups: string[] = []
  const r = await executePay(plan, 'pay1', deps(wallet(), { status: async () => ({ status: 'REFUNDED' }), onUpdate: (s: string) => ups.push(s) }))
  assert.equal(r.state, 'refunded'); assert.deepEqual(ups, ['deposited', 'refunded']); assert.equal(spentToday(), 20)
  releaseSpend('pay1'); assert.equal(spentToday(), 20)
  reserveSpend('x', 5); reserveSpend('x', 5); assert.equal(spentToday(), 25)
})
test('(3) SUCCESS keeps the spend; pending keeps it reserved and is not complete', async () => {
  const plan = await prep()
  assert.equal((await executePay(plan, 's', deps(wallet()))).state, 'complete'); assert.equal(spentToday(), 5)
  assert.equal((await executePay(plan, 'p', deps(wallet(), { status: async () => ({ status: 'PROCESSING' }) }))).state, 'pending'); assert.equal(spentToday(), 10)
})
test('(4) direct Base path: confirmed receipt = complete; reverted receipt = failed, no spend; no receipt = pending', async () => {
  const plan = await preparePay(5, EVM_TO, { resolve: async () => '', connect: async () => ME, quote: async () => { throw new Error('x') } })
  assert.equal((await executePay(plan, 'd1', deps(wallet(), { send: sendWith('0x0') }))).state, 'failed'); assert.equal(spentToday(), 0)
  assert.equal((await executePay(plan, 'd2', deps(wallet(), { send: sendWith(null) }))).state, 'pending'); assert.equal(spentToday(), 5)
  const w = wallet(); assert.equal((await executePay(plan, 'd3', deps(w))).state, 'complete'); assert.equal(signed(w), 1)
})
test('(4) deposit receipt failure on the Intents path → failed, spend never reserved', async () => {
  const plan = await prep()
  assert.equal((await executePay(plan, 'f', deps(wallet(), { send: sendWith('0x0') }))).state, 'failed'); assert.equal(spentToday(), 0)
  assert.ok(findAsset('USDC', 'Base'))
})
