// Native same-chain transfers. Same-chain sends never go through NEAR Intents: an EVM asset is a plain
// EVM transaction (native value or ERC-20 transfer), SOL is a plain Solana SystemProgram transfer.
// Everything that talks to a chain or wallet is injected so it can be tested with mocks.
import { decideLimit, type Caps } from './limits.ts'

export type Net = 'Ethereum' | 'Base' | 'Solana' | 'NEAR'
export type AssetDef = { sym: string; net: Net; decimals: number; kind: 'native' | 'erc20' | 'unsupported'; token?: string }
export const EVM_CHAINS: Record<'Ethereum' | 'Base', { chainId: string; rpc: string; explorer: string }> = {
  Ethereum: { chainId: '0x1', rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io/tx/' },
  Base: { chainId: '0x2105', rpc: 'https://base-rpc.publicnode.com', explorer: 'https://basescan.org/tx/' },
}
export const SOL_RPC = 'https://solana-rpc.publicnode.com'
// Only assets ORI can actually sign for with a connected wallet. NEAR is listed but disabled: no NEAR wallet connector exists.
export const ASSETS: AssetDef[] = [
  { sym: 'ETH', net: 'Ethereum', decimals: 18, kind: 'native' },
  { sym: 'ETH', net: 'Base', decimals: 18, kind: 'native' },
  { sym: 'USDC', net: 'Ethereum', decimals: 6, kind: 'erc20', token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { sym: 'USDC', net: 'Base', decimals: 6, kind: 'erc20', token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
  { sym: 'SOL', net: 'Solana', decimals: 9, kind: 'native' },
  { sym: 'NEAR', net: 'NEAR', decimals: 24, kind: 'unsupported' },
]
export const findAsset = (sym: string, net: string) => ASSETS.find(a => a.sym === sym && a.net === net) || null
export const unsupportedReason = (a: AssetDef | null) => !a ? 'ORI cannot send this asset on this network yet.' : a.kind === 'unsupported' ? `Sending ${a.sym} on ${a.net} is not available: ORI has no ${a.net} wallet connector that can sign. Nothing will be sent.` : null

export function validateRecipient(net: Net, addr: string): string | null {
  const a = addr.trim()
  if (!a) return 'Paste or type a recipient address.'
  if (net === 'Ethereum' || net === 'Base') return /^0x[0-9a-fA-F]{40}$/.test(a) ? (/^0x0{40}$/i.test(a) ? 'That is the zero address; funds would be burned.' : null) : `Not a valid ${net} (EVM) address. It should start with 0x and have 40 hex characters.`
  if (net === 'Solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) ? null : 'Not a valid Solana address (base58, 32–44 characters).'
  return 'This network is not supported for sending.'
}

// decimal string -> base units, exact (no float)
export function toUnits(amount: string, decimals: number): bigint | null {
  const s = amount.trim(); if (!/^\d+(\.\d+)?$/.test(s)) return null
  const [w, f = ''] = s.split('.'); if (f.length > decimals) return null
  const v = BigInt(w + f.padEnd(decimals, '0')); return v > 0n ? v : null
}
export const fromUnits = (v: bigint, decimals: number, max = 6) => { const s = v.toString().padStart(decimals + 1, '0'); const w = s.slice(0, -decimals) || '0', f = s.slice(-decimals).slice(0, max).replace(/0+$/, ''); return f ? `${w}.${f}` : w }

const pad32 = (h: string) => h.replace(/^0x/, '').toLowerCase().padStart(64, '0')
export function evmTxFor(a: AssetDef, from: string, to: string, units: bigint): { from: string; to: string; value?: string; data?: string } {
  if (a.kind === 'native') return { from, to, value: '0x' + units.toString(16) }
  if (a.kind === 'erc20' && a.token) return { from, to: a.token, value: '0x0', data: '0xa9059cbb' + pad32(to) + pad32(units.toString(16)) }
  throw new Error(unsupportedReason(a) || 'Unsupported asset.')
}

export type Rpc = (url: string, method: string, params: unknown[]) => Promise<any>
export const rpcFetch: Rpc = async (url, method, params) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(12000) })
  const j = await r.json(); if (j.error) throw new Error(j.error.message || 'RPC error'); return j.result
}

export type FeeEstimate = { feeUnits: bigint; feeSym: string; feeDecimals: number; detail: string }
export async function estimateFee(a: AssetDef, from: string, to: string, units: bigint, rpc: Rpc = rpcFetch): Promise<FeeEstimate> {
  if (a.net === 'Ethereum' || a.net === 'Base') {
    const c = EVM_CHAINS[a.net], tx = evmTxFor(a, from, to, units)
    const [gas, price] = await Promise.all([rpc(c.rpc, 'eth_estimateGas', [tx]), rpc(c.rpc, 'eth_gasPrice', [])])
    const g = BigInt(gas), p = BigInt(price)
    return { feeUnits: g * p, feeSym: 'ETH', feeDecimals: 18, detail: `${g} gas × ${fromUnits(p, 9, 3)} gwei (network fee, from ${a.net} RPC; your wallet may adjust)` }
  }
  if (a.net === 'Solana') {
    // a plain SOL transfer has 1 signature; base fee per signature from the chain's fee calculator
    const fee = await solTransferFee(from, to, units, rpc)
    return { feeUnits: fee, feeSym: 'SOL', feeDecimals: 9, detail: 'Solana network fee for one signature (from RPC getFeeForMessage)' }
  }
  throw new Error(unsupportedReason(a) || 'Unsupported network.')
}

async function solTransferFee(from: string, to: string, lamports: bigint, rpc: Rpc): Promise<bigint> {
  const { PublicKey, SystemProgram, TransactionMessage } = await import('@solana/web3.js')
  const bh = await rpc(SOL_RPC, 'getLatestBlockhash', [{ commitment: 'finalized' }])
  const msg = new TransactionMessage({ payerKey: new PublicKey(from), recentBlockhash: bh.value.blockhash, instructions: [SystemProgram.transfer({ fromPubkey: new PublicKey(from), toPubkey: new PublicKey(to), lamports })] }).compileToV0Message()
  const b64 = btoa(String.fromCharCode(...msg.serialize()))
  const r = await rpc(SOL_RPC, 'getFeeForMessage', [b64, { commitment: 'processed' }])
  if (r?.value == null) throw new Error('Solana fee unavailable right now.')
  return BigInt(r.value)
}

// A brand-new Solana account must receive at least the rent-exempt minimum, or the transfer fails.
export async function solRecipientCheck(to: string, lamports: bigint, rpc: Rpc = rpcFetch): Promise<string | null> {
  const [bal, min] = await Promise.all([rpc(SOL_RPC, 'getBalance', [to]), rpc(SOL_RPC, 'getMinimumBalanceForRentExemption', [0])])
  const have = BigInt(bal?.value ?? bal ?? 0), need = BigInt(min)
  return have === 0n && lamports < need ? `This Solana address has no account yet; send at least ${fromUnits(need, 9)} SOL (rent-exempt minimum) or the network rejects it.` : null
}
// Guard against a wrong/misconfigured RPC: it must report the expected chain.
export async function checkRpcChain(net: 'Ethereum' | 'Base', rpc: Rpc = rpcFetch): Promise<string | null> {
  const id = String(await rpc(EVM_CHAINS[net].rpc, 'eth_chainId', [])).toLowerCase()
  return id === EVM_CHAINS[net].chainId ? null : `The ${net} RPC reported a different chain. Nothing was sent.`
}
export async function balanceOf(a: AssetDef, owner: string, rpc: Rpc = rpcFetch): Promise<{ asset: bigint; native: bigint }> {
  if (a.net === 'Ethereum' || a.net === 'Base') {
    const c = EVM_CHAINS[a.net], native = BigInt(await rpc(c.rpc, 'eth_getBalance', [owner, 'latest']))
    if (a.kind === 'native') return { asset: native, native }
    const raw = await rpc(c.rpc, 'eth_call', [{ to: a.token, data: '0x70a08231' + pad32(owner) }, 'latest'])
    return { asset: BigInt(raw === '0x' ? 0 : raw), native }
  }
  if (a.net === 'Solana') { const r = await rpc(SOL_RPC, 'getBalance', [owner]); const v = BigInt(r?.value ?? r); return { asset: v, native: v } }
  throw new Error(unsupportedReason(a) || 'Unsupported network.')
}

// Final gate right before the wallet is asked to sign. Fail-closed.
export function preSignCheck(o: { a: AssetDef; units: bigint; fee: FeeEstimate; bal: { asset: bigint; native: bigint }; usd: number; caps: Caps; spent: number; recipientError: string | null }): string | null {
  const u = unsupportedReason(o.a); if (u) return u
  if (o.recipientError) return o.recipientError
  const lim = decideLimit(o.caps, o.usd, o.spent); if (lim) return lim
  if (o.a.kind === 'native') { if (o.bal.native < o.units + o.fee.feeUnits) return `Not enough ${o.a.sym} for the amount plus the network fee.` }
  else { if (o.bal.asset < o.units) return `Not enough ${o.a.sym} on ${o.a.net}.`; if (o.bal.native < o.fee.feeUnits) return `Not enough ${o.fee.feeSym} on ${o.a.net} to pay the network fee.` }
  return null
}

export type EvmProvider = { request: (a: { method: string; params?: unknown[] }) => Promise<any> }
export type SolProvider = { publicKey?: { toString(): string }; signAndSendTransaction: (tx: any) => Promise<{ signature: string }> }
export type SendResult = { hash: string; explorer: string; status: 'confirmed' | 'failed' | 'pending' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function sendEvm(p: EvmProvider, a: AssetDef, from: string, to: string, units: bigint, rpc: Rpc = rpcFetch, pollMs = 3000, polls = 40): Promise<SendResult> {
  const c = EVM_CHAINS[a.net as 'Ethereum' | 'Base']; if (!c) throw new Error(unsupportedReason(a) || 'Unsupported network.')
  const chain = String(await p.request({ method: 'eth_chainId' })).toLowerCase()
  if (chain !== c.chainId) await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: c.chainId }] })
  const after = String(await p.request({ method: 'eth_chainId' })).toLowerCase()
  if (after !== c.chainId) throw new Error(`Your wallet is not on ${a.net}. Nothing was sent.`)
  const accounts = await p.request({ method: 'eth_requestAccounts' }) as string[]
  if (!accounts?.some(x => x.toLowerCase() === from.toLowerCase())) throw new Error('The wallet account changed. Review the transfer again.')
  const hash = String(await p.request({ method: 'eth_sendTransaction', params: [evmTxFor(a, from, to, units)] }))
  for (let i = 0; i < polls; i++) { const r = await rpc(c.rpc, 'eth_getTransactionReceipt', [hash]).catch(() => null); if (r?.status) return { hash, explorer: c.explorer + hash, status: r.status === '0x1' ? 'confirmed' : 'failed' }; await sleep(pollMs) }
  return { hash, explorer: c.explorer + hash, status: 'pending' }
}

export async function sendSol(p: SolProvider, from: string, to: string, lamports: bigint, rpc: Rpc = rpcFetch, pollMs = 2000, polls = 40): Promise<SendResult> {
  if (p.publicKey?.toString() !== from) throw new Error('The Solana wallet account changed. Review the transfer again.')
  const { PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js')
  const bh = await rpc(SOL_RPC, 'getLatestBlockhash', [{ commitment: 'finalized' }])
  const tx = new Transaction({ feePayer: new PublicKey(from), recentBlockhash: bh.value.blockhash }).add(SystemProgram.transfer({ fromPubkey: new PublicKey(from), toPubkey: new PublicKey(to), lamports }))
  const { signature } = await p.signAndSendTransaction(tx)
  const explorer = 'https://solscan.io/tx/' + signature
  for (let i = 0; i < polls; i++) { const r = await rpc(SOL_RPC, 'getSignatureStatuses', [[signature]]).catch(() => null); const s = r?.value?.[0]; if (s) { if (s.err) return { hash: signature, explorer, status: 'failed' }; if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return { hash: signature, explorer, status: 'confirmed' } } await sleep(pollMs) }
  return { hash: signature, explorer, status: 'pending' }
}
