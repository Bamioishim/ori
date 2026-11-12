import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getAuthStore, setAuthStore, upstashStore } from '../api/auth/_store.ts'
import { sendCode, verifyCode } from '../api/auth/_codes.ts'

// Fake Upstash REST endpoint: POST JSON command array → { result }.
function fakeUpstash() {
  const kv = new Map<string, string>(), ttl = new Map<string, number>(), calls: { url: string; auth: string; args: string[] }[] = []
  const f = async (url: string, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body)) as string[]; calls.push({ url, auth: String((init!.headers as Record<string, string>).authorization), args })
    const [c, k, ...rest] = args; let result: unknown = null
    if (c === 'INCR') { const n = Number(kv.get(k) || 0) + 1; kv.set(k, String(n)); result = n }
    else if (c === 'EXPIRE') { ttl.set(k, Number(rest[0])); result = 1 }
    else if (c === 'SET') { if (rest.includes('NX') && kv.has(k)) result = null; else { kv.set(k, rest[0]); result = 'OK' } }
    return new Response(JSON.stringify({ result }), { status: 200 })
  }
  return { f, kv, ttl, calls }
}

test('no Upstash env → no store (email codes fail closed)', () => {
  setAuthStore(null)
  assert.equal(getAuthStore({}), null)
  assert.equal(getAuthStore({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io' }), null)
  assert.equal(getAuthStore({ UPSTASH_REDIS_REST_URL: 'http://insecure', UPSTASH_REDIS_REST_TOKEN: 't' }), null)
  assert.ok(getAuthStore({ UPSTASH_REDIS_REST_URL: 'https://x.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' }))
})
test('Upstash adapter: windowed counter, one-time consume, bearer auth, namespaced keys', async () => {
  const u = fakeUpstash(); const s = upstashStore('https://x.upstash.io/', 'tok', u.f)
  assert.equal(await s.hit('send:e:a', 600), 1); assert.equal(await s.hit('send:e:a', 600), 2)
  assert.equal(u.ttl.get('ori:rl:send:e:a'), 600)
  assert.equal(await s.consumeOnce('jti1', 600), true); assert.equal(await s.consumeOnce('jti1', 600), false)
  assert.ok(u.calls.every(c => c.url === 'https://x.upstash.io' && c.auth === 'Bearer tok'))
})
test('Upstash adapter errors surface (no silent pass)', async () => {
  const s = upstashStore('https://x.upstash.io', 'tok', async () => new Response('no', { status: 401 }))
  await assert.rejects(() => s.hit('k', 60), /401/)
  const s2 = upstashStore('https://x.upstash.io', 'tok', async () => new Response(JSON.stringify({ error: 'WRONGTYPE' }), { status: 200 }))
  await assert.rejects(() => s2.consumeOnce('k', 60), /command failed/)
})
test('code flow end-to-end on the Upstash adapter: replay rejected', async () => {
  const u = fakeUpstash(); const store = upstashStore('https://x.upstash.io', 'tok', u.f); const sent: string[] = []
  const deps = { store, secret: 'test-secret-not-real', send: async (_: string, c: string) => { sent.push(c) }, random: () => 42 }
  const r = await sendCode('a@gmail.com', 'ip', 'login', deps); assert.equal(r.status, 200)
  assert.equal((await verifyCode(String(r.body.challenge), sent[0], deps)).status, 200)
  assert.equal((await verifyCode(String(r.body.challenge), sent[0], deps)).status, 400)
})
