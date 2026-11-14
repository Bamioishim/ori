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

export const RECEIVE_NETWORKS = ['Base', 'Ethereum', 'Solana', 'NEAR'] as const
export type ReceiveNetwork = typeof RECEIVE_NETWORKS[number]
export type ReceiveRow = {
  network: ReceiveNetwork
  kind: AddrKind
  address: string | null
  source: 'native' | 'wallet' | 'watched' | null
  copyable: boolean
  /** Native ORI wallet chain that could not be derived (shown as unavailable, never a fake address). */
  nativeError?: string
}
/** Public addresses of the ORI native wallet (NEAR Auth + Chain Signatures). null = not derived. */
export type NativeAddrs = { near: string; evm: string | null; sol: string | null; errors?: { evm?: string; sol?: string } }

const KIND: Record<ReceiveNetwork, AddrKind> = { Base: 'evm', Ethereum: 'evm', Solana: 'sol', NEAR: 'near' }

/** Always four supported networks. Missing rows are not copyable and carry no address. */
export function receiveDirectory(
  wallets: { address: string; chain: string; label?: string; provider?: string }[],
  watched: string[],
  kindOf: (a: string) => AddrKind | null,
  native: NativeAddrs | null = null,
): ReceiveRow[] {
  const targets = receiveTargets(wallets, watched, kindOf)
  return RECEIVE_NETWORKS.map(network => {
    const kind = KIND[network]
    if (native) {
      const addr = kind === 'near' ? native.near : kind === 'evm' ? native.evm : native.sol
      if (addr && kindOf(addr) === kind) return { network, kind, address: addr, source: 'native', copyable: true }
    }
    const nativeError = native ? (kind === 'evm' ? native.errors?.evm : kind === 'sol' ? native.errors?.sol : undefined) || (kind !== 'near' ? 'Not derived yet' : undefined) : undefined
    const hit = targets.find(t => t.networks.includes(network))
    if (!hit) return { network, kind, address: null, source: null, copyable: false, ...(nativeError ? { nativeError } : {}) }
    return { network, kind: hit.kind, address: hit.address, source: hit.source, copyable: true }
  })
}

const isEvm = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a)
const isSol = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)
const isNear = (a: string) => /^([a-z0-9_-]+\.)*[a-z0-9_-]+\.(near|tg)$/.test(a) || /^[0-9a-f]{64}$/.test(a)

/** Error message, or null when the existing address may be stored as watch-only for that network. */
export function validateReceiveAddress(network: ReceiveNetwork, raw: string): string | null {
  const v = raw.trim()
  if (!v) return 'Enter an existing address.'
  const kind = KIND[network]
  if (kind === 'near') {
    if (v.toLowerCase() === 'near' || !isNear(v)) return 'That isn’t a NEAR account.'
    return null
  }
  if (kind === 'evm') {
    if (!isEvm(v)) return `Not a valid ${network} (EVM) address. It should start with 0x and have 40 hex characters.`
    if (/^0x0{40}$/i.test(v)) return 'That is the zero address; funds would be burned.'
    return null
  }
  return isSol(v) ? null : 'Not a valid Solana address (base58, 32–44 characters).'
}

/** Populated rows only. Returns null when there is nothing real to copy. */
export function formatCopyAll(rows: ReceiveRow[]): string | null {
  const lines = rows.filter(r => r.copyable && r.address).map(r => `${r.network}: ${r.address}`)
  return lines.length ? lines.join('\n') : null
}
