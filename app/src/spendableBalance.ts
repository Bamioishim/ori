// Spendable sizing for Swap. Example mock is never a live signing balance.
// Live/settlement sizing must use the exact active signer address + chain + token (fresh read).
// Watch-only portfolio aggregates must never cap or fund a signer.
import { assets as MOCK_ASSETS } from './mock.ts'
import { balanceOf, estimateFee, fromUnits, toUnits, type AssetDef, type FeeEstimate, type Rpc } from './transfers.ts'
import { chainKey, gasReserve, type HeldBal } from './uiLogic.ts'

export type SpendKind = 'example' | 'signer' | 'unknown'
export type SpendState = {
  kind: SpendKind
  /** Display units (approx for UI labels). Prefer maxStr/units for MAX and money guards. */
  amount: number | null
  /** Exact sendable base units (signer only). */
  units: bigint | null
  /** Exact decimal string for MAX (from units; no Number round-trip). */
  maxStr: string | null
  decimals: number | null
  owner: string | null
  fresh: boolean
  label: string
  reason: string | null
  feeNative: number | null
  feeNote: string | null
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

/** Like quoteVisible: never show a spend state from a different source for even one paint. */
export function visibleSpend(st: SpendState, sourceKey: string): SpendState {
  return st.sourceKey === sourceKey ? st : unknownSpend(sourceKey ? 'Source changed · refreshing…' : 'Available balance unknown', sourceKey)
}

export const exampleHeld = (): HeldBal[] => MOCK_ASSETS.map(a => ({ sym: a.sym, chain: a.chain, amt: a.amt }))

const emptyExact = { units: null as bigint | null, maxStr: null as string | null, decimals: null as number | null }

/** Example-only size from mock data. Never use for live signing caps. */
export function exampleSpendable(sym: string, blockchain: string): SpendState {
  const net = chainKey(blockchain)
  const reserve = gasReserve(sym, blockchain)
  const hits = MOCK_ASSETS.filter(a => a.sym === sym && a.chain === net)
  const sourceKey = `example|${net}|${sym}`
  if (!hits.length) {
    return { kind: 'example', amount: null, ...emptyExact, owner: null, fresh: true, label: 'example · not held', reason: null, feeNative: null, feeNote: null, sourceKey }
  }
  const raw = hits.reduce((s, a) => s + a.amt, 0)
  const amt = Math.max(0, raw - reserve)
  // Example MAX may use Number; it is explicitly not spendable / not live money.
  const maxStr = String(amt)
  return {
    kind: 'example', amount: amt, units: null, maxStr, decimals: null, owner: null, fresh: true,
    label: `example ${amt.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${sym} · not spendable`,
    reason: null, feeNative: reserve || null,
    feeNote: reserve > 0 ? 'approx example gas reserve (not a live fee quote)' : null,
    sourceKey,
  }
}

export function unknownSpend(reason: string, sourceKey = ''): SpendState {
  return { kind: 'unknown', amount: null, ...emptyExact, owner: null, fresh: false, label: 'available unknown', reason, feeNative: null, feeNote: null, sourceKey }
}

function exactMax(sendable: bigint, decimals: number): { amount: number; units: bigint; maxStr: string; decimals: number } {
  const maxStr = fromUnits(sendable, decimals, decimals) // full precision decimal string
  return { amount: Number(maxStr), units: sendable, maxStr, decimals }
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
  // Token OR native: fee estimate required to size MAX. Never claim full token balance usable without a gas check.
  if (!fee) {
    return unknownSpend(o.feeErr || 'Network fee estimate unavailable · cannot size MAX without a gas check', sourceKey)
  }
  let sendable = bal.asset
  if (a.kind === 'native') {
    sendable = bal.native > feeUnits ? bal.native - feeUnits : 0n
  } else if (bal.native < feeUnits) {
    const z = exactMax(0n, a.decimals)
    return {
      kind: 'signer', ...z, owner, fresh: true,
      label: `0 ${a.sym} · need ${fromUnits(feeUnits, fee.feeDecimals)} ${fee.feeSym} for gas`,
      reason: `Not enough ${fee.feeSym} for the network fee`,
      feeNative: Number(fromUnits(feeUnits, fee.feeDecimals)),
      feeNote: fee.detail + ' (approx until pre-sign)',
      sourceKey,
    }
  }
  const exact = exactMax(sendable, a.decimals)
  return {
    kind: 'signer', ...exact, owner, fresh: true,
    label: `${exact.maxStr} ${a.sym} · ${owner.slice(0, 4)}…${owner.slice(-4)}`,
    reason: null,
    feeNative: Number(fromUnits(fee.feeUnits, fee.feeDecimals)),
    feeNote: fee.detail + (a.kind === 'native' ? ' · approx until pre-sign' : ' · approx gas; re-checked before sign'),
    sourceKey,
  }
}

/** Shared amount guard for display and confirmation. Signer compares exact base units when possible. */
export function amountAllowed(st: SpendState, n: number, sym = '', amtStr?: string): string | null {
  if (!(n > 0)) return 'Enter an amount'
  if (st.kind === 'unknown') return st.reason || 'Available balance unknown · connect the signing wallet and wait for a fresh read'
  if (st.kind === 'signer' && !st.fresh) return 'Balance read is stale · wait for a fresh read'
  if (st.kind === 'signer' && st.units != null && st.decimals != null && amtStr != null && amtStr.trim() !== '') {
    const u = toUnits(amtStr.trim(), st.decimals)
    if (u == null) return 'Enter a valid amount'
    if (u > st.units) return `Only ${st.maxStr} ${sym} available on the signing wallet`.trim()
    return null
  }
  if (st.amount == null) return st.kind === 'example' ? null : (st.reason || 'Available balance unknown')
  if (n > st.amount + 1e-12) {
    return st.kind === 'example'
      ? `Only ${st.amount} ${sym} available in example data`.trim()
      : `Only ${st.maxStr ?? st.amount} ${sym} available on the signing wallet`.trim()
  }
  return null
}

export function canUseMax(st: SpendState): boolean {
  return !!st.maxStr && st.amount != null && st.amount > 0 && (st.kind === 'example' || (st.kind === 'signer' && st.fresh && st.units != null && st.units > 0n))
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
