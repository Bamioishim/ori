// Spendable sizing for Swap. Example mock is never a live signing balance.
// Live/settlement sizing must use the exact active signer address + chain + token (fresh read).
// Watch-only portfolio aggregates must never cap or fund a signer.
import { assets as MOCK_ASSETS } from './mock.ts'
import { balanceOf, estimateFee, fromUnits, type AssetDef, type FeeEstimate, type Rpc } from './transfers.ts'
import { chainKey, gasReserve, type HeldBal } from './uiLogic.ts'

export type SpendKind = 'example' | 'signer' | 'unknown'
export type SpendState = {
  kind: SpendKind
  /** Human units that may be sized into the amount field (after approx gas reserve when known). */
  amount: number | null
  /** Exact owner this number belongs to (signer only). */
  owner: string | null
  /** True when amount came from a completed fresh read for that owner+asset. */
  fresh: boolean
  /** Label for the UI (must not claim spendable when example/unknown). */
  label: string
  reason: string | null
  feeNative: number | null
  feeNote: string | null
  /** Source key that produced this state (owner|net|sym|token). */
  sourceKey: string
}

export type WalletPick = { id: string; chain: 'evm' | 'sol'; address: string }

/** Example UI uses mock only when settlement signing is off. Live UI / settlement never uses mock. */
export function sizingKind(uiMode: 'example' | 'live', settlementLive: boolean): 'example' | 'signer' {
  return uiMode === 'example' && !settlementLive ? 'example' : 'signer'
}

/** Prefer the active wallet matching the chain; never a watch-only address. */
export function pickSigner(wallets: WalletPick[], activeId: string | null, blockchain: string): string | null {
  const chain: 'evm' | 'sol' | null = blockchain === 'sol' ? 'sol' : (blockchain === 'eth' || blockchain === 'base' || blockchain === 'arb' || blockchain === 'op' || blockchain === 'pol' || blockchain === 'bsc' || blockchain === 'avax') ? 'evm' : null
  if (!chain) return null
  const match = wallets.filter(w => w.chain === chain)
  if (!match.length) return null
  const act = activeId ? match.find(w => w.id === activeId) : undefined
  return (act || match[0]).address
}

export function spendSourceKey(owner: string | null, asset: Pick<AssetDef, 'sym' | 'net' | 'kind' | 'token'> | null): string {
  if (!owner || !asset) return ''
  return `${owner}|${asset.net}|${asset.sym}|${asset.kind}|${asset.token || ''}`
}

export const exampleHeld = (): HeldBal[] => MOCK_ASSETS.map(a => ({ sym: a.sym, chain: a.chain, amt: a.amt }))

/** Example-only size from mock data. Never use for live signing caps. */
export function exampleSpendable(sym: string, blockchain: string): SpendState {
  const net = chainKey(blockchain)
  const reserve = gasReserve(sym, blockchain)
  const hits = MOCK_ASSETS.filter(a => a.sym === sym && a.chain === net)
  const sourceKey = `example|${net}|${sym}`
  if (!hits.length) {
    return { kind: 'example', amount: null, owner: null, fresh: true, label: 'example · not held', reason: null, feeNative: null, feeNote: null, sourceKey }
  }
  const raw = hits.reduce((s, a) => s + a.amt, 0)
  const amt = Math.max(0, raw - reserve)
  return {
    kind: 'example', amount: amt, owner: null, fresh: true,
    label: `example ${amt.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${sym} · not spendable`,
    reason: null, feeNative: reserve || null,
    feeNote: reserve > 0 ? 'approx example gas reserve (not a live fee quote)' : null,
    sourceKey,
  }
}

export function unknownSpend(reason: string, sourceKey = ''): SpendState {
  return { kind: 'unknown', amount: null, owner: null, fresh: false, label: 'available unknown', reason, feeNative: null, feeNote: null, sourceKey }
}

/** Build spendable from a fresh balanceOf + optional fee estimate for one signer. */
export function signerSpendable(o: {
  asset: AssetDef
  owner: string
  bal: { asset: bigint; native: bigint }
  fee: FeeEstimate | null
  feeErr?: string | null
}): SpendState {
  const { asset: a, owner, bal, fee } = o
  const sourceKey = spendSourceKey(owner, a)
  const feeUnits = fee?.feeUnits ?? 0n
  let sendable = bal.asset
  if (a.kind === 'native') {
    if (!fee) return unknownSpend(o.feeErr || 'Network fee estimate unavailable · cannot size MAX safely', sourceKey)
    sendable = bal.native > feeUnits ? bal.native - feeUnits : 0n
  } else if (fee && bal.native < feeUnits) {
    return {
      kind: 'signer', amount: 0, owner, fresh: true,
      label: `0 ${a.sym} · need ${fromUnits(feeUnits, fee.feeDecimals)} ${fee.feeSym} for gas`,
      reason: `Not enough ${fee.feeSym} for the network fee`,
      feeNative: Number(fromUnits(feeUnits, fee.feeDecimals)),
      feeNote: fee.detail + ' (approx until pre-sign)',
      sourceKey,
    }
  }
  const amount = Number(fromUnits(sendable, a.decimals))
  return {
    kind: 'signer', amount, owner, fresh: true,
    label: `${amount.toLocaleString('en-US', { maximumFractionDigits: a.decimals === 9 ? 4 : 6 })} ${a.sym} · ${owner.slice(0, 4)}…${owner.slice(-4)}`,
    reason: null,
    feeNative: fee ? Number(fromUnits(fee.feeUnits, fee.feeDecimals)) : null,
    feeNote: fee
      ? fee.detail + (a.kind === 'native' ? ' · approx until pre-sign' : ' · approx gas; re-checked before sign')
      : (o.feeErr || 'Fee not estimated · pre-sign will re-check gas'),
    sourceKey,
  }
}

/** Shared amount guard for display and confirmation. */
export function amountAllowed(st: SpendState, n: number, sym = ''): string | null {
  if (!(n > 0)) return 'Enter an amount'
  if (st.kind === 'unknown') return st.reason || 'Available balance unknown · connect the signing wallet and wait for a fresh read'
  if (st.kind === 'signer' && !st.fresh) return 'Balance read is stale · wait for a fresh read'
  if (st.amount == null) return st.kind === 'example' ? null : (st.reason || 'Available balance unknown')
  if (n > st.amount + 1e-12) {
    return st.kind === 'example'
      ? `Only ${st.amount} ${sym} available in example data`.trim()
      : `Only ${st.amount} ${sym} available on the signing wallet`.trim()
  }
  return null
}

export function canUseMax(st: SpendState): boolean {
  return st.amount != null && st.amount > 0 && (st.kind === 'example' || (st.kind === 'signer' && st.fresh))
}

/** Fresh signer read + fee estimate (fee probe uses self as recipient — labelled approximate). */
export async function readSignerSpendable(asset: AssetDef, owner: string, probeUnits: bigint, rpc?: Rpc): Promise<SpendState> {
  const sourceKey = spendSourceKey(owner, asset)
  let fee: FeeEstimate | null = null
  let feeErr: string | null = null
  try {
    fee = await estimateFee(asset, owner, owner, probeUnits > 0n ? probeUnits : 1n, rpc)
  } catch (e) {
    feeErr = (e as Error).message || 'Fee estimate failed'
  }
  try {
    const bal = await balanceOf(asset, owner, rpc)
    return signerSpendable({ asset, owner, bal, fee, feeErr })
  } catch (e) {
    return unknownSpend((e as Error).message || 'Balance read failed', sourceKey)
  }
}
