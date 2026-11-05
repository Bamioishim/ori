// Pure: which real addresses can receive, per network. Only user-connected wallets and addresses the user
// added themselves; never example/demo data.
export type AddrKind = 'evm' | 'sol' | 'near'
export type Target = { address: string; kind: AddrKind; networks: string[]; source: 'wallet' | 'watched'; label: string }
export const NETWORKS: Record<AddrKind, string[]> = { evm: ['Base', 'Ethereum'], sol: ['Solana'], near: ['NEAR'] }
export function receiveTargets(wallets: { address: string; chain: string; label?: string; provider?: string }[], watched: string[], kindOf: (a: string) => AddrKind | null): Target[] {
  const out: Target[] = [], seen = new Set<string>()
  const add = (address: string, source: Target['source'], label: string) => {
    const kind = kindOf(address); if (!kind) return
    const key = kind + ':' + (kind === 'evm' ? address.toLowerCase() : address); if (seen.has(key)) return; seen.add(key)
    out.push({ address, kind, networks: NETWORKS[kind], source, label })
  }
  for (const w of wallets) add(w.address, 'wallet', w.label || w.provider || 'Connected wallet')
  for (const a of watched) add(a, 'watched', 'Address you added')
  return out
}
