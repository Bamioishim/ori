// Durable state for login codes: one-time use (replay protection) and rate limits.
// A per-process Map is NOT safe on serverless (instances are many and short-lived), so ORI refuses to issue
// or accept codes until a real durable store is configured. Supported store: Upstash Redis REST
// (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, server-only). Vercel Marketplace may inject
// KV_REST_API_URL + KV_REST_API_TOKEN instead; those names are accepted as a matching pair. Without a pair, email codes fail closed.
export interface AuthStore {
  /** Count one hit for `key` in a sliding window; returns the count including this hit. */
  hit(key: string, windowSec: number): Promise<number>
  /** Atomically mark a challenge id used. Returns true only the first time. */
  consumeOnce(id: string, ttlSec: number): Promise<boolean>
}
type Fetch = (url: string, init?: RequestInit) => Promise<Response>
let injected: AuthStore | null = null
let cached: { key: string; store: AuthStore } | null = null
/** For tests or another adapter the owner approves. */
export function setAuthStore(s: AuthStore | null) { injected = s; cached = null }

/** Upstash Redis REST adapter. Keys are namespaced; the token is only ever sent as a Bearer header. */
export function upstashStore(url: string, token: string, f: Fetch = (u, i) => fetch(u, i)): AuthStore {
  const base = url.trim().replace(/\/+$/, '')
  const cmd = async (args: (string | number)[]) => {
    const r = await f(base, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args.map(String)) })
    if (!r.ok) throw new Error(`ORI auth store request failed (${r.status}).`)
    const body = await r.json() as { result?: unknown; error?: string }
    if (body.error) throw new Error('ORI auth store command failed.')
    return body.result
  }
  return {
    async hit(key, windowSec) {
      const k = 'ori:rl:' + key
      const n = Number(await cmd(['INCR', k]))
      if (n === 1) await cmd(['EXPIRE', k, windowSec])
      if (!Number.isFinite(n)) throw new Error('ORI auth store returned an invalid counter.')
      return n
    },
    async consumeOnce(id, ttlSec) {
      return (await cmd(['SET', 'ori:once:' + id, '1', 'EX', ttlSec, 'NX'])) === 'OK'
    },
  }
}

/** Prefer the documented Upstash names; fall back to a complete Vercel Marketplace KV_* pair. Do not mix the two. */
export function redisCreds(env: Record<string, string | undefined>): { url: string; token: string } | null {
  const official = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN } : null
  const marketplace = env.KV_REST_API_URL && env.KV_REST_API_TOKEN ? { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN } : null
  const picked = official || marketplace
  if (!picked || !/^https:\/\//.test(picked.url)) return null
  return picked
}

export function getAuthStore(env: Record<string, string | undefined> = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}): AuthStore | null {
  if (injected) return injected
  const creds = redisCreds(env)
  if (!creds) return null
  const key = creds.url + '|' + creds.token.length
  if (!cached || cached.key !== key) cached = { key, store: upstashStore(creds.url, creds.token) }
  return cached.store
}
export const STORE_MISSING = 'Email login codes are not available yet: ORI needs a durable server store for one-time codes and rate limits, and none is configured. You can keep using ORI as a guest.'
export const LIMITS = { sendPerEmail: 3, sendPerIp: 10, sendWindowSec: 600, verifyAttempts: 5, codeTtlSec: 600 }
