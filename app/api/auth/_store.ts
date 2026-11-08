// Durable state for login codes: one-time use (replay protection) and rate limits.
// Vercel functions are ephemeral, so use Upstash Redis REST rather than a process-local Map.
export interface AuthStore {
  hit(key: string, windowSec: number): Promise<number>
  consumeOnce(id: string, ttlSec: number): Promise<boolean>
}
let injected: AuthStore | null = null
let cached: AuthStore | null = null
export function setAuthStore(s: AuthStore | null) { injected = s; cached = null }

function upstashStore(url: string, token: string): AuthStore {
  const base = url.replace(/\\/$/, '')
  const command = async (parts: string[]) => {
    const path = parts.map(encodeURIComponent).join('/')
    const r = await fetch(base + '/' + path, { headers: { authorization: 'Bearer ' + token, accept: 'application/json' } })
    if (!r.ok) throw new Error('ORI auth storage request failed (' + r.status + ').')
    const body = await r.json() as { result?: unknown; error?: string }
    if (body.error) throw new Error('ORI auth storage command failed.')
    return body.result
  }
  return {
    async hit(key, windowSec) {
      const n = Number(await command(['incr', key]))
      if (n === 1) await command(['expire', key, String(windowSec)])
      return n
    },
    async consumeOnce(id, ttlSec) {
      const result = await command(['set', id, '1', 'EX', String(ttlSec), 'NX'])
      return result === 'OK'
    },
  }
}

export function getAuthStore(): AuthStore | null {
  if (injected) return injected
  if (cached) return cached
  const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env
  const url = env?.UPSTASH_REDIS_REST_URL, token = env?.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  cached = upstashStore(url, token)
  return cached
}
export const STORE_MISSING = 'Email codes are temporarily unavailable: ORI needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for secure one-time code storage.'
export const LIMITS = { sendPerEmail: 3, sendPerIp: 10, sendWindowSec: 600, verifyAttempts: 5, codeTtlSec: 600 }
