// ORI native wallet, built on NEAR Auth (mainnet) + NEAR Chain Signatures.
// Pure helpers and read-only NEAR RPC views only. No private key exists anywhere in ORI: the user's NEAR key
// is held by the MPC network (v1.signer) and only signs after an Auth0 approval checked on-chain by fast-auth.near.
// Docs: https://docs.auth.near.org (quickstart, resources/mainnet, guides/sign-transactions)
import { keccak_256 } from '@noble/hashes/sha3'
import { decideLimit, type Caps } from './limits.ts'

export const NEAR_AUTH = {
  network: 'mainnet' as const,
  // Public Auth0 SPA client config issued to ORI by NEAR Auth. Not a secret.
  clientId: 'b6UA35Hea4utXEzCwwoTPnyikGiqwyiq',
  domain: 'login.auth.near.org',
  signingAudience: 'auth0.jwt.fast-auth.near',
  fastAuthContractId: 'fast-auth.near',
  jwtGuardRouter: 'jwt.fast-auth.near',
  auth0Guard: 'auth0.jwt.fast-auth.near',
  mpcContractId: 'v1.signer',
  rpc: 'https://rpc.mainnet.near.org',
  explorer: 'https://nearblocks.io',
}
// Chain Signatures derivation paths. One EVM path so Base and Ethereum share one address, like a normal wallet.
export const PATHS = { evm: 'ethereum-1', sol: 'solana-1' } as const
// MPC domain ids, as used by the NEAR Auth SDK (getDomainIdOrFail): secp256k1 = 0, ed25519 = 1.
export const DOMAIN = { secp256k1: 0, ed25519: 1 } as const

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function b58decode(s: string): Uint8Array {
  let n = 0n
  for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error('Invalid base58'); n = n * 58n + BigInt(i) }
  const out: number[] = []
  while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n }
  for (const c of s) { if (c === '1') out.unshift(0); else break }
  return Uint8Array.from(out)
}
export function b58encode(b: Uint8Array): string {
  let n = 0n; for (const x of b) n = (n << 8n) + BigInt(x)
  let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n }
  for (const x of b) { if (x === 0) s = '1' + s; else break }
  return s
}
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')

/** Parses an MPC/NEAR key string like `ed25519:<base58>` or `secp256k1:<base58>`. */
export function parseKey(k: string): { curve: 'ed25519' | 'secp256k1'; bytes: Uint8Array } {
  const m = /^(ed25519|secp256k1):([1-9A-HJ-NP-Za-km-z]+)$/.exec(String(k).trim())
  if (!m) throw new Error('Unexpected public key format from the MPC signer.')
  const bytes = b58decode(m[2]); const curve = m[1] as 'ed25519' | 'secp256k1'
  if (curve === 'ed25519' && bytes.length !== 32) throw new Error('ed25519 key must be 32 bytes.')
  if (curve === 'secp256k1' && bytes.length !== 64) throw new Error('secp256k1 key must be 64 bytes (uncompressed, no prefix).')
  return { curve, bytes }
}
/** NEAR implicit account id = lowercase hex of the 32-byte ed25519 public key. */
export function implicitAccountId(ed25519Key: string): string {
  const { curve, bytes } = parseKey(ed25519Key); if (curve !== 'ed25519') throw new Error('NEAR account key must be ed25519.')
  return hex(bytes)
}
/** EIP-55 checksummed EVM address from a 64-byte uncompressed secp256k1 key. */
export function evmAddress(secpKey: string): string {
  const { curve, bytes } = parseKey(secpKey); if (curve !== 'secp256k1') throw new Error('EVM address needs a secp256k1 key.')
  const addr = hex(keccak_256(bytes).slice(-20))
  const h = hex(keccak_256(new TextEncoder().encode(addr)))
  return '0x' + [...addr].map((c, i) => parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c).join('')
}
/** Solana address = base58 of the ed25519 public key. */
export function solAddress(edKey: string): string {
  const { curve, bytes } = parseKey(edKey); if (curve !== 'ed25519') throw new Error('Solana address needs an ed25519 key.')
  return b58encode(bytes)
}

export type Fetch = typeof fetch
export async function nearRpc<T = any>(method: string, params: unknown, f: Fetch = fetch): Promise<T> {
  const r = await f(NEAR_AUTH.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'ori', method, params }) })
  if (!r.ok) throw new Error(`NEAR RPC HTTP ${r.status}`)
  const j = await r.json()
  if (j.error) throw new Error(j.error?.cause?.name || j.error?.data || j.error?.message || 'NEAR RPC error')
  if (j.result?.error) throw new Error(String(j.result.error))
  return j.result as T
}
const b64 = (s: string) => typeof btoa === 'function' ? btoa(s) : Buffer.from(s).toString('base64')
export async function nearView<T = any>(contract: string, method: string, args: unknown, f: Fetch = fetch): Promise<T> {
  const res = await nearRpc<{ result: number[] }>('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name: method, args_base64: b64(JSON.stringify(args)) }, f)
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(res.result))) as T
}
/** MPC `derived_public_key` view on v1.signer (read-only, no transaction). */
export const derivedKey = (path: string, predecessor: string, domain: number, f: Fetch = fetch) =>
  nearView<string>(NEAR_AUTH.mpcContractId, 'derived_public_key', { path, predecessor, domain_id: domain }, f)

export type ChainAddr = { address: string; path: string } | null
export type NativeWallet = {
  v: 1
  authPath: string            // jwt#https://login.auth.near.org/#<sub>
  nearPublicKey: string       // ed25519:… derived by MPC for fast-auth.near + authPath
  nearAccountId: string       // implicit account (hex)
  evm: ChainAddr               // Chain Signatures, secp256k1, path ethereum-1 → Base + Ethereum
  sol: ChainAddr               // Chain Signatures, ed25519, path solana-1
  errors: { evm?: string; sol?: string }
  derivedAt: number
}
/** Derive every receiving address from the NEAR Auth key. A chain that fails stays null with its reason; never a placeholder. */
export async function deriveWallet(authPath: string, nearPublicKey: string, f: Fetch = fetch, now = Date.now()): Promise<NativeWallet> {
  const nearAccountId = implicitAccountId(nearPublicKey)
  const w: NativeWallet = { v: 1, authPath, nearPublicKey, nearAccountId, evm: null, sol: null, errors: {}, derivedAt: now }
  const [e, s] = await Promise.allSettled([
    derivedKey(PATHS.evm, nearAccountId, DOMAIN.secp256k1, f).then(evmAddress),
    derivedKey(PATHS.sol, nearAccountId, DOMAIN.ed25519, f).then(solAddress),
  ])
  if (e.status === 'fulfilled') w.evm = { address: e.value, path: PATHS.evm }; else w.errors.evm = (e.reason as Error)?.message || 'Derivation failed'
  if (s.status === 'fulfilled') w.sol = { address: s.value, path: PATHS.sol }; else w.errors.sol = (s.reason as Error)?.message || 'Derivation failed'
  return w
}
/** Re-derive the NEAR Auth key for a stored authPath (view) and check it matches, so a tampered record is not trusted. */
export async function verifyNearKey(authPath: string, f: Fetch = fetch): Promise<string> {
  return derivedKey(authPath, NEAR_AUTH.fastAuthContractId, DOMAIN.ed25519, f)
}

const KEY = 'ori-native-wallet'
const isAddr = (x: unknown): x is ChainAddr => x === null || (!!x && typeof (x as any).address === 'string' && typeof (x as any).path === 'string')
export function isNativeWallet(x: any): x is NativeWallet {
  if (!x || x.v !== 1 || typeof x.authPath !== 'string' || typeof x.nearPublicKey !== 'string' || !isAddr(x.evm) || !isAddr(x.sol)) return false
  try {
    if (implicitAccountId(x.nearPublicKey) !== x.nearAccountId) return false
    if (x.evm && !/^0x[0-9a-fA-F]{40}$/.test(x.evm.address)) return false
    if (x.sol && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(x.sol.address)) return false
  } catch { return false }
  return true
}
export function loadNativeWallet(): NativeWallet | null { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return isNativeWallet(r) ? r : null } catch { return null } }
export function saveNativeWallet(w: NativeWallet) { localStorage.setItem(KEY, JSON.stringify(w)); dispatchEvent(new Event(KEY)) }
export function forgetNativeWallet() { localStorage.removeItem(KEY); dispatchEvent(new Event(KEY)) }
export const NATIVE_EVENT = KEY

// ---- NEAR same-chain send (read-only pieces; signing lives in nearAuth.ts) ----
export const YOCTO = 24
export const isNearAccount = (a: string) => /^[0-9a-f]{64}$/.test(a) || /^0x[0-9a-f]{40}$/.test(a) || /^(?=.{2,64}$)([a-z0-9]+[-_])*[a-z0-9]+(\.([a-z0-9]+[-_])*[a-z0-9]+)*$/.test(a) && /\.(near|tg)$/.test(a)
export function validateNearRecipient(a: string, self?: string): string | null {
  const v = a.trim()
  if (!v) return 'Paste or type a NEAR account.'
  if (!isNearAccount(v)) return 'Not a NEAR mainnet account (name.near, or a 64-character implicit id).'
  if (self && v === self) return 'That is your own ORI wallet.'
  return null
}
/** Balance in yocto, or null when the implicit account is not on-chain yet (it activates on the first NEAR received). */
export async function nearBalance(accountId: string, f: Fetch = fetch): Promise<{ total: bigint; locked: bigint; storageUsage: number } | null> {
  try {
    const r = await nearRpc<{ amount: string; locked: string; storage_usage: number }>('query', { request_type: 'view_account', finality: 'final', account_id: accountId }, f)
    return { total: BigInt(r.amount), locked: BigInt(r.locked), storageUsage: r.storage_usage }
  } catch (e) { if (/UNKNOWN_ACCOUNT|does not exist/i.test((e as Error).message)) return null; throw e }
}
// Storage staking: 1e19 yocto per byte (NEAR protocol). The staked part cannot be sent.
export const spendable = (b: { total: bigint; locked: bigint; storageUsage: number }) => { const s = b.total - b.locked - BigInt(b.storageUsage) * 10n ** 19n; return s > 0n ? s : 0n }
// A plain transfer burns ~0.45 Tgas; we reserve 1 Tgas at the live gas price as the fee estimate.
export async function nearFee(f: Fetch = fetch): Promise<bigint> { const r = await nearRpc<{ gas_price: string }>('gas_price', [null], f); return BigInt(r.gas_price) * 1_000_000_000_000n }
export async function accessKey(accountId: string, publicKey: string, f: Fetch = fetch): Promise<{ nonce: bigint; blockHash: string }> {
  const r = await nearRpc<{ nonce: number | string; block_hash: string; permission: unknown }>('query', { request_type: 'view_access_key', finality: 'final', account_id: accountId, public_key: publicKey }, f)
  if (r.permission !== 'FullAccess') throw new Error('The ORI wallet key on this account is not a full-access key.')
  return { nonce: BigInt(r.nonce), blockHash: r.block_hash }
}
/** Optional relayer for the `sign` call to fast-auth.near. It needs a funded NEAR account on a server; ORI ships none. */
export function relayerUrl(env: Record<string, unknown> = (import.meta as any).env ?? {}): string | null {
  const u = String(env.VITE_ORI_NEAR_RELAYER_URL || '').trim()
  return /^https:\/\/[^\s]+$/.test(u) ? u.replace(/\/$/, '') : null
}
export const NO_RELAYER = 'ORI wallets are receive-only for now. NEAR Auth signing needs a relayer (a server with a funded NEAR account that submits the approved request to fast-auth.near), and ORI has none configured yet, so nothing can be signed or sent.'

/** Fail-closed pre-sign check for a native NEAR send. Same client-side spending-limit rail as every other ORI send. */
export function nearSendCheck(o: { to: string; self: string; units: bigint | null; fee: bigint | null; spendable: bigint | null; usd: number; caps: Caps; spent: number; relayer: string | null }): string | null {
  const r = validateNearRecipient(o.to, o.self); if (r) return r
  if (!o.units || o.units <= 0n) return 'Enter a positive NEAR amount.'
  if (o.fee === null) return 'Network fee is unavailable, so ORI will not ask NEAR Auth to sign.'
  if (o.spendable === null) return 'Your ORI NEAR account is not on-chain yet. It activates when it first receives NEAR.'
  if (!(o.usd > 0)) return 'No live USD price for NEAR, so ORI cannot check your spending limits. Nothing was sent.'
  const lim = decideLimit(o.caps, o.usd, o.spent); if (lim) return lim
  if (o.spendable < o.units + o.fee) return 'Not enough NEAR for the amount plus the network fee (some NEAR stays locked for account storage).'
  if (!o.relayer) return NO_RELAYER
  return null
}
