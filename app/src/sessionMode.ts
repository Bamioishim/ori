// Guest demo vs registered mainnet separation (from the Nov 8 fix/guest-mainnet-auth-transfer work), kept pure for tests.
// Guest: example data and DEMO-only payments; nothing is signed. Registered (Gmail account or an ORI wallet on this device):
// live data only, demo activity hidden, and payments never fall back to a simulated "success".
export type UiMode = 'example' | 'live'
export type SessionKind = 'guest' | 'registered'

export function sessionKind(o: { account: unknown; nativeWallet: unknown }): SessionKind {
  return o.account || o.nativeWallet ? 'registered' : 'guest'
}
/** Registered sessions are locked to live data; guests keep whatever they picked. */
export function effectiveMode(requested: UiMode, kind: SessionKind): UiMode {
  return kind === 'registered' ? 'live' : requested
}
export const canUseExample = (kind: SessionKind) => kind === 'guest'

/** Registered sessions see only real activity; DEMO entries stay on the device but are not shown. */
export function visibleHistory<T extends { demo?: boolean }>(list: T[], kind: SessionKind): T[] {
  return kind === 'registered' ? list.filter(t => !t.demo) : list
}

export type PayRoute = { route: 'demo' } | { route: 'live' } | { route: 'blocked'; reason: string }
export const MAINNET_OFF = 'Mainnet payments are not configured on this deployment. No funds were moved.'
export const EXAMPLE_REGISTERED = 'Example handles like @tolu are for the guest demo only. Use a verified handle or a real address. Nothing was sent.'
/**
 * Which path a Pay review takes.
 *  - guest → DEMO (no wallet, no quote deposit, logged as DEMO)
 *  - registered + example handle → blocked (no demo money inside a mainnet session)
 *  - registered + settlement off → blocked (never a simulated success)
 *  - registered + settlement on → live (reviewed plan, wallet signs)
 */
export function payRoute(o: { kind: SessionKind; exampleHandle: boolean; settlementEnabled: boolean }): PayRoute {
  if (o.kind === 'guest') return { route: 'demo' }
  if (o.exampleHandle) return { route: 'blocked', reason: EXAMPLE_REGISTERED }
  if (!o.settlementEnabled) return { route: 'blocked', reason: MAINNET_OFF }
  return { route: 'live' }
}

/** ORI's own (NEAR Auth / Chain Signatures) wallet can receive; sending needs a funded NEAR relayer ORI does not run. */
export const ORI_WALLET_RECEIVE_ONLY = 'Receive-only for now. ORI wallets can receive on NEAR, Base, Ethereum and Solana, but sending from them needs a NEAR signing relayer that is not set up yet. To send, use a connected wallet (MetaMask, Phantom).'
export const oriWalletCanSend = (relayer: string | null) => !!relayer
