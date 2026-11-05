// Live Pay (Base USDC). Review builds ONE plan; execution signs exactly that plan.
//  - Solana recipient: cross-chain via NEAR Intents → reuses executeSwap (bound quote, direct deposit, status poll).
//  - EVM recipient on Base: direct USDC transfer via sendEvm (chain + account re-check, receipt confirmation).
// Spending is reserved only after a broadcast and released once on REFUNDED / failed.
import { checkSwapQuote, executeSwap, type SwapReview, type SwapState } from './swapExec.ts'
import { findAsset, sendEvm, toUnits, type EvmProvider, type SendResult } from './transfers.ts'
import type { SettlementQuote, SettlementStatus } from './live.ts'

export const BASE_USDC_ID = 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near'
export const SOL_USDC_ID = 'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near'
const EVM = /^0x[0-9a-fA-F]{40}$/, SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export type PayPlan =
  | { kind: 'intents'; usd: number; account: string; display: string; review: SwapReview; settlement: SettlementQuote }
  | { kind: 'direct'; usd: number; account: string; display: string; to: string; units: bigint }
export type PrepDeps = { resolve: (h: string) => Promise<string>; connect: () => Promise<string>; quote: (o: { from: string; to: string; amount: bigint; recipient: string; refundTo: string }) => Promise<SettlementQuote>; now?: () => number }
export async function preparePay(amt: number, to: string, d: PrepDeps): Promise<PayPlan> {
  const units = toUnits(String(amt), 6); if (!units) throw new Error('Amount is not valid.')
  let recipient = to.trim()
  if (!SOL.test(recipient) && !EVM.test(recipient)) recipient = await d.resolve(recipient)
  const account = await d.connect()
  if (!EVM.test(account)) throw new Error('No EVM wallet account was selected.')
  if (EVM.test(recipient)) return { kind: 'direct', usd: amt, account, display: to, to: recipient, units }
  if (!SOL.test(recipient)) throw new Error('Recipient is not a valid Solana or Base address.')
  const settlement = await d.quote({ from: BASE_USDC_ID, to: SOL_USDC_ID, amount: units, recipient, refundTo: account })
  const min = String(settlement?.quote?.minAmountOut ?? '')
  if (!/^\d+$/.test(min)) throw new Error('1Click quote has no minimum output. Nothing was sent.')
  const review: SwapReview = { originAsset: BASE_USDC_ID, destinationAsset: SOL_USDC_ID, units, recipient, refundTo: account, originNet: 'Base', account, minOutUnits: BigInt(min) }
  const bad = checkSwapQuote(settlement, review, d.now?.() ?? Date.now()); if (bad) throw new Error(bad)
  return { kind: 'intents', usd: amt, account, display: to, review, settlement }
}
export type PayResult = { state: SwapState; tx?: string; depositAddress?: string }
export type ExecDeps = {
  provider: EvmProvider | null; limit: () => string | null
  status: (dep: string) => Promise<SettlementStatus>
  reserve: (id: string, v: number) => void; release: (id: string) => void
  onUpdate?: (st: SwapState | 'deposited', info: { tx?: string; depositAddress?: string }) => void
  send?: typeof sendEvm; sleep?: (ms: number) => Promise<void>; polls?: number; now?: () => number
}
const USDC_BASE = findAsset('USDC', 'Base')!
export async function executePay(plan: PayPlan, holdId: string, d: ExecDeps): Promise<PayResult> {
  const why = d.limit(); if (why) throw new Error(why)
  const p = d.provider; if (!p) throw new Error('No EVM wallet found. Nothing was sent.')
  const send = d.send ?? sendEvm
  const settle = (st: SwapState, info: { tx?: string; depositAddress?: string }) => { if (st === 'refunded' || st === 'failed') d.release(holdId); d.onUpdate?.(st, info) }
  if (plan.kind === 'direct') {
    const r: SendResult = await send(p, USDC_BASE, plan.account, plan.to, plan.units)
    if (r.status !== 'failed') d.reserve(holdId, plan.usd)
    const st: SwapState = r.status === 'confirmed' ? 'complete' : r.status === 'failed' ? 'failed' : 'pending'
    settle(st, { tx: r.hash }); return { state: st, tx: r.hash }
  }
  const res = await executeSwap(plan.review, USDC_BASE, {
    quote: async () => plan.settlement, limit: d.limit, currentAccount: () => plan.account,
    deposit: (a, to, u) => send(p, a, plan.account, to, u),
    status: d.status, sleep: d.sleep, polls: d.polls, now: d.now,
    onUpdate: (st, info) => { if (st === 'deposited') { d.reserve(holdId, plan.usd); d.onUpdate?.('deposited', info) } else settle(st, info) },
  })
  return { state: res.state, tx: res.tx, depositAddress: res.depositAddress }
}
