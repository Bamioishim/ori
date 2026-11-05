// Durable state for login codes: one-time use (replay protection) and rate limits.
// A per-process Map is NOT safe on serverless (instances are many and short-lived), so ORI refuses to issue
// or accept codes until a real durable store is wired in. No store is configured for ORI today.
export interface AuthStore {
  /** Count one hit for `key` in a sliding window; returns the count including this hit. */
  hit(key: string, windowSec: number): Promise<number>
  /** Atomically mark a challenge id used. Returns true only the first time. */
  consumeOnce(id: string, ttlSec: number): Promise<boolean>
}
let injected: AuthStore | null = null
/** For tests or a future adapter (e.g. a KV/Redis/DB the owner approves). */
export function setAuthStore(s: AuthStore | null) { injected = s }
export function getAuthStore(): AuthStore | null { return injected }
export const STORE_MISSING = 'Email login codes are not available yet: ORI needs a durable server store for one-time codes and rate limits, and none is configured. You can keep using ORI as a guest.'
export const LIMITS = { sendPerEmail: 3, sendPerIp: 10, sendWindowSec: 600, verifyAttempts: 5, codeTtlSec: 600 }
