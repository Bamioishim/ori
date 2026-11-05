// Shared (browser + server) 1Click token catalog handling. Source of truth: GET https://1click.chaindefuser.com/v0/tokens.
// The catalog says what NEAR Intents can ROUTE. It does not say what ORI can SIGN: only origins with a wallet
// adapter below are executable. Everything else is shown as quote-only / not executable.
export type CatalogToken = { assetId: string; symbol: string; blockchain: string; decimals: number; price: number; contractAddress?: string }
const ASSET_ID = /^nep(141|245):[a-z0-9._:-]{1,120}$/i
export function normalizeTokens(raw: unknown): CatalogToken[] {
  if (!Array.isArray(raw)) return []
  const out: CatalogToken[] = [], seen = new Set<string>()
  for (const t of raw as any[]) {
    if (!t || typeof t.assetId !== 'string' || !ASSET_ID.test(t.assetId) || seen.has(t.assetId)) continue
    if (typeof t.symbol !== 'string' || !/^[\w.$+-]{1,20}$/.test(t.symbol) || typeof t.blockchain !== 'string' || !/^[a-z0-9]{2,20}$/.test(t.blockchain)) continue
    if (!Number.isInteger(t.decimals) || t.decimals < 0 || t.decimals > 36) continue
    const price = typeof t.price === 'number' && Number.isFinite(t.price) && t.price >= 0 ? t.price : 0
    seen.add(t.assetId)
    out.push({ assetId: t.assetId, symbol: t.symbol, blockchain: t.blockchain, decimals: t.decimals, price, ...(typeof t.contractAddress === 'string' ? { contractAddress: t.contractAddress } : {}) })
  }
  return out
}
// Chains whose recipient address format ORI validates. Others are quote-only.
export const EVM_CHAINS = new Set(['eth', 'base', 'arb', 'op', 'pol', 'bsc', 'gnosis', 'avax', 'scroll', 'bera'])
export function validAddressFor(blockchain: string, a: string): boolean {
  a = a.trim()
  if (EVM_CHAINS.has(blockchain)) return /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0{40}$/i.test(a)
  if (blockchain === 'sol') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)
  if (blockchain === 'near') return /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a) && a.length >= 2 && a.length <= 64
  return false
}
// Origins ORI can actually sign a deposit for, using its EVM (Ethereum/Base) and Solana wallet adapters.
export type Executable = { net: 'Ethereum' | 'Base' | 'Solana'; kind: 'native' | 'erc20'; token?: string }
export function originAdapter(t: CatalogToken): Executable | null {
  const net = t.blockchain === 'eth' ? 'Ethereum' : t.blockchain === 'base' ? 'Base' : t.blockchain === 'sol' ? 'Solana' : null
  if (!net) return null
  if (net === 'Solana') return t.symbol === 'SOL' && !t.contractAddress ? { net, kind: 'native' } : null // SPL deposits not implemented yet
  if (!t.contractAddress) return t.symbol === 'ETH' ? { net, kind: 'native' } : null
  return /^0x[0-9a-fA-F]{40}$/.test(t.contractAddress) ? { net, kind: 'erc20', token: t.contractAddress.toLowerCase() } : null
}
export type QuoteReq = { originAsset: string; destinationAsset: string; amount: string; recipient: string; refundTo: string; deadline?: string }
export function validateRoute(cat: CatalogToken[], v: Partial<QuoteReq>, now = Date.now()): QuoteReq | string {
  const o = cat.find(t => t.assetId === v.originAsset), d = cat.find(t => t.assetId === v.destinationAsset)
  if (!o || !d) return 'Asset is not in the NEAR Intents token list.'
  if (o.assetId === d.assetId) return 'Origin and destination assets must differ. Same-asset sends use a direct transfer, not NEAR Intents.'
  if (o.blockchain === d.blockchain && o.symbol === d.symbol) return 'Same asset on the same chain: use a direct transfer.'
  if (!originAdapter(o)) return `ORI cannot sign deposits for ${o.symbol} on ${o.blockchain} yet.`
  if (!/^\d{1,30}$/.test(String(v.amount)) || BigInt(String(v.amount)) <= 0n) return 'Amount must be a positive integer in the asset’s smallest unit.'
  if (!validAddressFor(d.blockchain, String(v.recipient || ''))) return `Recipient is not a valid ${d.blockchain} address, or ORI cannot validate addresses on that chain.`
  if (!validAddressFor(o.blockchain, String(v.refundTo || ''))) return `Refund address is not a valid ${o.blockchain} address.`
  const deadline = v.deadline ? new Date(v.deadline) : new Date(now + 3 * 60 * 1000)
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= now) return 'Deadline must be in the future.'
  if (deadline.getTime() > now + 15 * 60 * 1000) return 'Deadline cannot be more than 15 minutes away.'
  return { originAsset: o.assetId, destinationAsset: d.assetId, amount: String(v.amount), recipient: String(v.recipient).trim(), refundTo: String(v.refundTo).trim(), deadline: deadline.toISOString() }
}
