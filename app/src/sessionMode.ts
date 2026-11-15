// Guest demo vs registered mainnet separation. NEAR Auth wallet creation is enabled;
// guests keep the safe demo path, while authenticated accounts use live/read-only data.
export const GUEST_ONLY = false
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
/** Guest sessions use DEMO; registered sessions fail closed unless live settlement is explicitly enabled. */
export function payRoute(o: { kind: SessionKind; exampleHandle: boolean; settlementEnabled: boolean }): PayRoute {
  if (o.kind === 'guest') return { route: 'demo' }
  if (o.exampleHandle) return { route: 'blocked', reason: EXAMPLE_REGISTERED }
  if (!o.settlementEnabled) return { route: 'blocked', reason: MAINNET_OFF }
  return { route: 'live' }
}

/** ORI's NEAR Auth wallet can derive receiving addresses. Sending remains disabled until a reviewed signer/relayer exists. */
export const ORI_WALLET_RECEIVE_ONLY = 'Receive-only for now. ORI can derive your NEAR, Base/Ethereum and Solana receiving addresses through NEAR Auth and Chain Signatures. Sending from the built-in wallet is not enabled yet, so nothing can be signed or sent.'
export const oriWalletCanSend = (relayer: string | null) => !!relayer
