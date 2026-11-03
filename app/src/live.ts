// Read-only live data plus an explicitly opt-in settlement boundary. The browser never sees the 1Click JWT.
const ONECLICK = 'https://1click.chaindefuser.com/v0'
export const RPC = { eth: 'https://ethereum-rpc.publicnode.com', base: 'https://base-rpc.publicnode.com', sol: 'https://solana-rpc.publicnode.com', solIndexed: '/rpc/sol', near: 'https://rpc.mainnet.fastnear.com' }
export const ASSET = {
  baseUSDC: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
  solUSDC: 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
  SOL: 'nep141:sol.omft.near', baseETH: 'nep141:base.omft.near',
}
// Placeholder addresses used ONLY inside dry quotes (dry:true never returns a deposit address, nothing can be sent).
export const PREVIEW = { sol: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', evm: '0x0000000000000000000000000000000000000001' }

export type Token = { assetId: string; symbol: string; blockchain: string; price: number; decimals: number; priceUpdatedAt: string }
let tokP: Promise<Token[]> | null = null
const timeout = (ms: number) => AbortSignal.timeout(ms)
export function tokens() {
  tokP ??= fetch(ONECLICK + '/tokens', { signal: timeout(10000) }).then(r => { if (!r.ok) throw new Error('1Click tokens ' + r.status); return r.json() }).catch(e => { tokP = null; throw e })
  return tokP
}
export const price = (ts: Token[], sym: string, chain: string) => ts.find(t => t.symbol === sym && t.blockchain === chain)?.price ?? ts.find(t => t.symbol === sym)?.price ?? 0

export type Quote = { amountInUsd: number; amountOutUsd: number; amountOut: number; minOut: number; eta: number; fee: number; bps: number; at: string }
export async function quote(o: { from: string; to: string; amount: bigint; recipient: string; refundTo: string; outDecimals: number }): Promise<Quote> {
  const r = await fetch(ONECLICK + '/quote', {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: timeout(12000),
    body: JSON.stringify({ dry: true, swapType: 'EXACT_INPUT', slippageTolerance: 100, originAsset: o.from, depositType: 'ORIGIN_CHAIN', destinationAsset: o.to, amount: o.amount.toString(), refundTo: o.refundTo, refundType: 'ORIGIN_CHAIN', recipient: o.recipient, recipientType: 'DESTINATION_CHAIN', deadline: new Date(Date.now() + 36e5).toISOString() }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.message || '1Click quote ' + r.status)
  const q = j.quote, inU = +q.amountInUsd, outU = +q.amountOutUsd
  return { amountInUsd: inU, amountOutUsd: outU, amountOut: +q.amountOut / 10 ** o.outDecimals, minOut: +q.minAmountOut / 10 ** o.outDecimals, eta: q.timeEstimate, fee: inU - outU, bps: j.quoteRequest?.appFees?.reduce((a: number, f: any) => a + f.fee, 0) ?? 0, at: j.timestamp }
}

export type SettlementQuote = {
  correlationId: string
  timestamp: string
  signature: string
  quoteRequest: Record<string, unknown>
  quote: {
    depositAddress: string
    depositMemo?: string
    amountIn: string
    amountInFormatted?: string
    amountInUsd?: string
    amountOut: string
    amountOutFormatted?: string
    amountOutUsd?: string
    minAmountOut?: string
    timeEstimate?: number
  }
}

export type SettlementStatus = {
  correlationId: string
  status: 'PENDING_DEPOSIT' | 'KNOWN_DEPOSIT_TX' | 'INCOMPLETE_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'REFUNDED' | 'FAILED'
  updatedAt: string
  quoteResponse: SettlementQuote
  swapDetails?: { intentHashes?: string[]; nearTxHashes?: string[]; amountInFormatted?: string; amountOutFormatted?: string; amountOutUsd?: string }
}

const settlementEnabled = import.meta.env.VITE_ORI_SETTLEMENT_MODE === 'live'
export const isSettlementEnabled = () => settlementEnabled

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(body.error || body.message || `ORI API ${r.status}`)
  return body as T
}

export async function createSettlementQuote(o: { from: string; to: string; amount: bigint; recipient: string; refundTo: string }): Promise<SettlementQuote> {
  if (!settlementEnabled) throw new Error('Live settlement is disabled in this preview.')
  return apiJson<SettlementQuote>('/api/quote', { method: 'POST', body: JSON.stringify({ originAsset: o.from, destinationAsset: o.to, amount: o.amount.toString(), recipient: o.recipient, refundTo: o.refundTo }) })
}

export async function settlementStatus(depositAddress: string, depositMemo?: string): Promise<SettlementStatus> {
  if (!settlementEnabled) throw new Error('Live settlement is disabled in this preview.')
  const q = new URLSearchParams({ depositAddress }); if (depositMemo) q.set('depositMemo', depositMemo)
  return apiJson<SettlementStatus>('/api/status?' + q.toString())
}

// ---------- address detection ----------
export type Kind = 'evm' | 'sol' | 'near'
export function kindOf(a: string): Kind | null {
  a = a.trim()
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'evm'
  if (/^([a-z0-9_-]+\.)*[a-z0-9_-]+\.(near|tg)$/.test(a) || /^[0-9a-f]{64}$/.test(a) || a === 'near') return 'near'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'sol'
  return null
}

// ---------- balances (read-only) ----------
async function rpc(url: string, method: string, params: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: timeout(10000) })
  const j = await r.json(); if (j.error) throw new Error(j.error.message || 'rpc error'); return j.result
}
const hex = (h: string) => Number(BigInt(h))
const balOf = (addr: string) => '0x70a08231' + addr.slice(2).toLowerCase().padStart(64, '0')
const USDC = { eth: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', sol: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', near: '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1' }
const partial: string[] = []
export type Holding = { sym: string; chain: 'Ethereum' | 'Base' | 'Solana' | 'NEAR'; amt: number; usd: number; addr: string }
export type ReadResult = { holdings: Holding[]; errors: string[] }

async function evm(addr: string, ts: Token[]): Promise<Holding[]> {
  const out: Holding[] = []
  for (const [chain, url, key] of [['Ethereum', RPC.eth, 'eth'], ['Base', RPC.base, 'base']] as const) {
    const [n, u] = await Promise.all([rpc(url, 'eth_getBalance', [addr, 'latest']), rpc(url, 'eth_call', [{ to: USDC[key], data: balOf(addr) }, 'latest'])])
    const e = hex(n) / 1e18, us = hex(u === '0x' ? '0x0' : u) / 1e6
    out.push({ sym: 'ETH', chain, amt: e, usd: e * price(ts, 'ETH', key), addr }, { sym: 'USDC', chain, amt: us, usd: us * price(ts, 'USDC', key), addr })
  }
  return out
}
async function sol(addr: string, ts: Token[]): Promise<Holding[]> {
  const [b, t] = await Promise.all([rpc(RPC.sol, 'getBalance', [addr]), (import.meta.env.DEV ? rpc(RPC.solIndexed, 'getTokenAccountsByOwner', [addr, { mint: USDC.sol }, { encoding: 'jsonParsed' }]).catch(() => null) : Promise.resolve(null))])
  const s = b.value / 1e9, u = t ? t.value.reduce((a: number, x: any) => a + (x.account.data.parsed.info.tokenAmount.uiAmount || 0), 0) : 0
  if (!t) partial.push(import.meta.env.DEV ? `${short(addr)}: SOL read, USDC (SPL) needs an indexed RPC` : `${short(addr)}: Solana USDC unavailable in preview`)
  return [{ sym: 'SOL', chain: 'Solana', amt: s, usd: s * price(ts, 'SOL', 'sol'), addr }, { sym: 'USDC', chain: 'Solana', amt: u, usd: u * price(ts, 'USDC', 'sol'), addr }]
}
async function near(addr: string, ts: Token[]): Promise<Holding[]> {
  const a = await rpc(RPC.near, 'query', { request_type: 'view_account', finality: 'final', account_id: addr }).catch(e => { throw new Error(/server error|does not exist|UNKNOWN_ACCOUNT/i.test(e.message) ? 'NEAR account not found' : e.message) })
  const n = Number(BigInt(a.amount) / 10n ** 18n) / 1e6
  let u = 0
  try { const r = await rpc(RPC.near, 'query', { request_type: 'call_function', finality: 'final', account_id: USDC.near, method_name: 'ft_balance_of', args_base64: btoa(JSON.stringify({ account_id: addr })) }); u = +JSON.parse(String.fromCharCode(...r.result)) / 1e6 } catch { /* no USDC storage */ }
  return [{ sym: 'NEAR', chain: 'NEAR', amt: n, usd: n * price(ts, 'wNEAR', 'near'), addr }, { sym: 'USDC', chain: 'NEAR', amt: u, usd: u * price(ts, 'USDC', 'near'), addr }]
}
export async function readPortfolio(addrs: string[]): Promise<ReadResult> {
  const ts = await tokens()
  const res = await Promise.allSettled(addrs.map(a => { const k = kindOf(a); return k === 'evm' ? evm(a, ts) : k === 'sol' ? sol(a, ts) : k === 'near' ? near(a, ts) : Promise.reject(new Error('unrecognised address')) }))
  const holdings: Holding[] = [], errors: string[] = []
  errors.push(...partial.splice(0))
  res.forEach((r, i) => r.status === 'fulfilled' ? holdings.push(...r.value.filter(h => h.amt > 0)) : errors.push(`${short(addrs[i])}: ${(r.reason as Error).message}`))
  return { holdings: holdings.sort((a, b) => b.usd - a.usd), errors }
}
export const short = (a: string) => a.length > 16 ? a.slice(0, 6) + '…' + a.slice(-4) : a

// ---------- GoPlus address security (public, no key) ----------
export type Risk = { state: 'clean' | 'flagged' | 'unsupported' | 'error'; flags: string[]; source: string }
const RISK_KEYS = ['cybercrime', 'money_laundering', 'financial_crime', 'darkweb_transactions', 'phishing_activities', 'fake_kyc', 'blacklist_doubt', 'stealing_attack', 'blackmail_activities', 'sanctioned', 'malicious_mining_activities', 'mixer', 'honeypot_related_address', 'fake_token']
export async function goplus(addr: string): Promise<Risk> {
  if (kindOf(addr) !== 'evm') return { state: 'unsupported', flags: [], source: 'GoPlus covers EVM addresses here' }
  try {
    const r = await fetch(`https://api.gopluslabs.io/api/v1/address_security/${addr}?chain_id=1`, { signal: timeout(10000) })
    const j = await r.json(); if (j.code !== 1 || !j.result) throw new Error(j.message || 'GoPlus error')
    const flags = RISK_KEYS.filter(k => j.result[k] === '1').map(k => k.replace(/_/g, ' '))
    return { state: flags.length ? 'flagged' : 'clean', flags, source: 'GoPlus' + (j.result.data_source ? ' · ' + j.result.data_source : '') }
  } catch (e) { return { state: 'error', flags: [], source: (e as Error).message } }
}
