import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sendCode, verifyCode } from '../api/auth/_codes.ts'
import type { AuthStore } from '../api/auth/_store.ts'
function memStore(): AuthStore { const hits = new Map<string, number>(), used = new Set<string>(); return { async hit(k) { const n = (hits.get(k) || 0) + 1; hits.set(k, n); return n }, async consumeOnce(id) { if (used.has(id)) return false; used.add(id); return true } } }
const secret = 'test-secret-not-real'
const mk = () => { const sent: string[] = []; return { sent, deps: { store: memStore(), secret, send: async (_to: string, c: string) => { sent.push(c) }, random: () => 123456 } } }
test('fails closed with no durable store (current production state)', async () => {
  const r = await sendCode('a@gmail.com', '1.1.1.1', 'register', { store: null, secret, send: async () => {} }); assert.equal(r.status, 503); assert.match(String(r.body.error), /durable server store/)
  assert.equal((await verifyCode('x.y', '123456', { store: null, secret })).status, 503)
})
test('fails closed with no Gmail/secret config', async () => { assert.equal((await sendCode('a@gmail.com', 'ip', 'login', { store: memStore() })).status, 503) })
test('register code verifies once; replay rejected', async () => {
  const { sent, deps } = mk(); const s = await sendCode('A@gmail.com', 'ip', 'register', deps); assert.equal(s.status, 200)
  const ch = String(s.body.challenge); assert.doesNotMatch(ch, new RegExp(sent[0])) // code not in challenge
  const v = await verifyCode(ch, sent[0], deps); assert.equal(v.status, 200); assert.equal(v.body.email, 'a@gmail.com'); assert.equal(v.body.purpose, 'register')
  assert.equal((await verifyCode(ch, sent[0], deps)).status, 400)
})
test('wrong code, tampered challenge, expiry, attempt limit', async () => {
  const { sent, deps } = mk(); const ch = String((await sendCode('b@gmail.com', 'ip', 'login', deps)).body.challenge)
  assert.equal((await verifyCode(ch, '000000', deps)).status, 400)
  assert.equal((await verifyCode('A' + ch.slice(1), sent[0], deps)).status, 400)
  assert.equal((await verifyCode(ch, sent[0], { ...deps, now: () => Date.now() + 11 * 60 * 1000 })).status, 400)
  for (let i = 0; i < 4; i++) await verifyCode(ch, '000000', deps)
  assert.equal((await verifyCode(ch, sent[0], deps)).status, 429)
})
test('send rate limit per email', async () => { const { deps } = mk(); for (let i = 0; i < 3; i++) assert.equal((await sendCode('c@gmail.com', 'ip' + i, 'login', deps)).status, 200); assert.equal((await sendCode('c@gmail.com', 'ipx', 'login', deps)).status, 429) })
test('non-gmail and unknown purpose rejected', async () => { const { deps } = mk(); assert.equal((await sendCode('a@yahoo.com', 'ip', 'login', deps)).status, 400); assert.equal((await sendCode('a@gmail.com', 'ip', 'admin', deps)).status, 400) })
test('frontend: registration creates the account only after a verified register code', () => {
  const s = readFileSync(new URL('../src/Account.tsx', import.meta.url), 'utf8'); const save = s.slice(s.indexOf('const save = '), s.indexOf('const sendCode'))
  assert.doesNotMatch(save, /localStorage\.setItem\('ori-account'/); assert.match(save, /sendCode\('register'\)/)
  assert.match(s, /j\.purpose !== 'register'/)
  assert.doesNotMatch(readFileSync(new URL('../api/auth/_store.ts', import.meta.url), 'utf8'), /new Map/)
})
