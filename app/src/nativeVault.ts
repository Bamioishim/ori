import { Keypair } from '@solana/web3.js'
import { secp256k1 } from '@noble/curves/secp256k1'
import { keccak_256 } from '@noble/hashes/sha3'

const STORAGE_KEY = 'ori-native-vault-v1'
const ITERATIONS = 310_000
const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141')
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type VaultMetadata = {
  version: 1
  createdAt: number
  evmAddress: string
  solAddress: string
  salt: string
  iv: string
  ciphertext: string
  iterations: number
}
export type UnlockedVault = { evmPrivateKey: Uint8Array; solSecretKey: Uint8Array; evmAddress: string; solAddress: string }
type SecretPayload = { version: 1; evmPrivateKey: string; solSecretKey: string }

const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0))
const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
const fromHex = (value: string) => Uint8Array.from(value.match(/.{2}/g) || [], x => parseInt(x, 16))
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length))
const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => { const copy = new ArrayBuffer(bytes.byteLength); new Uint8Array(copy).set(bytes); return copy }
const evmAddress = (privateKey: Uint8Array) => {
  const publicKey = secp256k1.getPublicKey(privateKey, false).slice(1)
  return '0x' + toHex(keccak_256(publicKey).slice(-20))
}
const solAddress = (secretKey: Uint8Array) => Keypair.fromSecretKey(secretKey).publicKey.toBase58()

async function encryptionKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
function validatePassword(password: string) {
  if (password.length < 12) throw new Error('Use a vault password with at least 12 characters.')
}
function validateMetadata(value: unknown): value is VaultMetadata {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<VaultMetadata>
  return v.version === 1 && Number.isSafeInteger(v.createdAt) && /^0x[0-9a-f]{40}$/i.test(v.evmAddress || '') &&
    /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.solAddress || '') && typeof v.salt === 'string' &&
    typeof v.iv === 'string' && typeof v.ciphertext === 'string' && v.iterations === ITERATIONS
}
function stored(): VaultMetadata | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return null; const value = JSON.parse(raw); return validateMetadata(value) ? value : null } catch { return null }
}
function persist(vault: VaultMetadata) { localStorage.setItem(STORAGE_KEY, JSON.stringify(vault)) }

let unlocked: UnlockedVault | null = null
export const hasNativeVault = () => stored() !== null
export const nativeVaultMetadata = () => {
  const v = stored()
  return v ? { createdAt: v.createdAt, evmAddress: v.evmAddress, solAddress: v.solAddress } : null
}
export const getUnlockedVault = () => unlocked
export function lockNativeVault() {
  if (unlocked) { unlocked.evmPrivateKey.fill(0); unlocked.solSecretKey.fill(0) }
  unlocked = null
}

async function decrypt(vault: VaultMetadata, password: string): Promise<UnlockedVault> {
  validatePassword(password)
  const key = await encryptionKey(password, fromBase64(vault.salt), vault.iterations)
  let plaintext: ArrayBuffer
  try { plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asArrayBuffer(fromBase64(vault.iv)) }, key, asArrayBuffer(fromBase64(vault.ciphertext))) }
  catch { throw new Error('Incorrect vault password or damaged backup.') }
  const payload = JSON.parse(decoder.decode(plaintext)) as SecretPayload
  if (payload.version !== 1) throw new Error('Unsupported wallet backup version.')
  const evmPrivateKey = fromHex(payload.evmPrivateKey)
  const solSecretKey = fromBase64(payload.solSecretKey)
  if (evmPrivateKey.length !== 32 || solSecretKey.length !== 64 ||
      evmAddress(evmPrivateKey).toLowerCase() !== vault.evmAddress.toLowerCase() ||
      solAddress(solSecretKey) !== vault.solAddress) throw new Error('Wallet backup integrity check failed.')
  return { evmPrivateKey, solSecretKey, evmAddress: vault.evmAddress, solAddress: vault.solAddress }
}

export async function createNativeVault(password: string) {
  validatePassword(password)
  if (stored()) throw new Error('A native wallet vault already exists on this device.')
  let evmPrivateKey: Uint8Array
  do { evmPrivateKey = randomBytes(32) } while (BigInt('0x' + toHex(evmPrivateKey)) === 0n || BigInt('0x' + toHex(evmPrivateKey)) >= CURVE_ORDER)
  const sol = Keypair.generate()
  const secrets: SecretPayload = { version: 1, evmPrivateKey: toHex(evmPrivateKey), solSecretKey: toBase64(sol.secretKey) }
  const salt = randomBytes(16), iv = randomBytes(12)
  const key = await encryptionKey(password, salt, ITERATIONS)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, key, encoder.encode(JSON.stringify(secrets)))
  const vault: VaultMetadata = { version: 1, createdAt: Date.now(), evmAddress: evmAddress(evmPrivateKey), solAddress: sol.publicKey.toBase58(), salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)), iterations: ITERATIONS }
  persist(vault)
  unlocked = { evmPrivateKey, solSecretKey: sol.secretKey.slice(), evmAddress: vault.evmAddress, solAddress: vault.solAddress }
  return nativeVaultMetadata()!
}

export async function unlockNativeVault(password: string) {
  const vault = stored()
  if (!vault) throw new Error('No native wallet vault exists on this device. Create one or import a backup.')
  lockNativeVault()
  unlocked = await decrypt(vault, password)
  return nativeVaultMetadata()!
}

export function exportEncryptedVaultBackup() {
  const vault = stored()
  if (!vault) throw new Error('There is no wallet vault to back up.')
  return JSON.stringify(vault)
}

export async function importEncryptedVaultBackup(backup: string, password: string) {
  if (stored()) throw new Error('A native wallet vault already exists on this device. Remove it before importing.')
  let parsed: unknown
  try { parsed = JSON.parse(backup) } catch { throw new Error('That backup is not valid JSON.') }
  if (!validateMetadata(parsed)) throw new Error('That backup is not a supported ORI encrypted wallet backup.')
  const restored = await decrypt(parsed, password)
  persist(parsed)
  unlocked = restored
  return nativeVaultMetadata()!
}

export async function removeNativeVault(password: string) {
  const vault = stored()
  if (!vault) return
  const verified = await decrypt(vault, password)
  verified.evmPrivateKey.fill(0); verified.solSecretKey.fill(0)
  lockNativeVault()
  localStorage.removeItem(STORAGE_KEY)
}
