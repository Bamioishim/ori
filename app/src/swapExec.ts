// Guarded live swap execution via NEAR Intents 1Click (cross-chain only).
// Flow: reviewed route -> fresh dry:false quote (server) -> bind quote to review -> limit re-check
// -> wallet-authorized deposit to depositAddress (native / ERC20 transfer / SPL transferChecked; never an approval)
// -> poll 1Click status. History is "complete" only when the provider reports SUCCESS.
import type { SettlementQuote, SettlementStatus } from './live.ts'
import type { AssetDef, SendResult } from './transfers.ts'

export type SwapReview = {
  originAsset: string; destinationAsset: string; units: bigint; recipient: string; refundTo: string
  originNet: 'Ethereum' | 'Base' | 'Solana'; account: string; minOutUnits: bigint // reviewed amountOut less slippage the user saw
}
const EVM = /^0x[0-9a-fA-F]{40}$/, SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export function checkSwapQuote(s: SettlementQuote, r: SwapReview, now = Date.now()): string | null {
  const q = s?.quote; if (!q) return '1Click returned no quote. Nothing was sent.'
  const req = (s.quoteRequest || {}) as Record<string, unknown>
  if (req.originAsset !== r.originAsset || req.destinationAsset !== r.destinationAsset) return 'The quote route does not match what you reviewed. Nothing was sent.'
  if (String(req.recipient) !== r.recipient) return 'The quote recipient does not match what you reviewed. Nothing was sent.'
  if (String(req.refundTo) !== r.refundTo) return 'The quote refund address does not match what you reviewed. Nothing was sent.'
  if (!/^\d+$/.test(String(q.amountIn)) || BigInt(q.amountIn) !== r.units) return 'The quote amount does not match what you reviewed. Nothing was sent.'
  if (!(r.originNet === 'Solana' ? SOL : EVM).test(String(q.depositAddress))) return '1Click returned an invalid deposit address for this chain. Nothing was sent.'
  if ((q as any).depositMemo) return 'This route needs a deposit memo, which ORI does not support. Nothing was sent.'
  if (!q.deadline || !(Date.parse(q.deadline) > now + 30_000)) return 'The quote expired or has no deadline. Review a fresh quote.'
  const out = String((q as any).minAmountOut ?? q.amountOut)
  if (!/^\d+$/.test(out) || BigInt(out) < r.minOutUnits) return 'The price moved below what you reviewed (fees or output changed). Review again.'
  return null
}
export type SwapState = 'pending' | 'complete' | 'refunded' | 'failed'
export function mapStatus(s: SettlementStatus['status'] | undefined): SwapState {
  return s === 'SUCCESS' ? 'complete' : s === 'REFUNDED' ? 'refunded' : s === 'FAILED' ? 'failed' : 'pending'
}
export type SwapDeps = {
  quote: () => Promise<SettlementQuote>
  limit: () => string | null
  currentAccount: () => string | null
  deposit: (asset: AssetDef, to: string, units: bigint) => Promise<SendResult>
  status: (depositAddress: string) => Promise<SettlementStatus>
  onUpdate?: (st: SwapState | 'deposited', info: { depositAddress?: string; tx?: string }) => void
  sleep?: (ms: number) => Promise<void>; polls?: number; pollMs?: number; now?: () => number
}
export async function executeSwap(r: SwapReview, asset: AssetDef, d: SwapDeps): Promise<{ state: SwapState; depositAddress: string; tx: string }> {
  const s = await d.quote()
  const bad = checkSwapQuote(s, r, d.now?.() ?? Date.now()); if (bad) throw new Error(bad)
  const why = d.limit(); if (why) throw new Error(why)
  if (d.currentAccount() !== r.account) throw new Error('The wallet account changed since review. Nothing was sent.')
  const dep = s.quote.depositAddress
  const sent = await d.deposit(asset, dep, BigInt(s.quote.amountIn)) // wallet refusal throws here: nothing sent
  if (sent.status === 'failed') { d.onUpdate?.('failed', { depositAddress: dep, tx: sent.hash }); return { state: 'failed', depositAddress: dep, tx: sent.hash } }
  d.onUpdate?.('deposited', { depositAddress: dep, tx: sent.hash })
  const sleep = d.sleep ?? (ms => new Promise(res => setTimeout(res, ms)))
  let state: SwapState = 'pending'
  for (let i = 0; i < (d.polls ?? 90); i++) {
    const st = await d.status(dep).catch(() => null)
    state = mapStatus(st?.status)
    if (state !== 'pending') break
    await sleep(d.pollMs ?? 5000)
  }
  d.onUpdate?.(state, { depositAddress: dep, tx: sent.hash })
  return { state, depositAddress: dep, tx: sent.hash }
}
