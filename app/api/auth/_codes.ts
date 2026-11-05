// Pure handlers for sending/verifying email codes. Transport, store, clock and secret are injected.
import { LIMITS, STORE_MISSING, type AuthStore } from './_store.js'
const bytes = (s: string) => new TextEncoder().encode(s)
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => { const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0))) }
const hmac = async (s: string, key: string) => b64url(new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', bytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), bytes(s))))
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0 }
export const GMAIL = /^[^\s@]+@gmail\.com$/
export type Res = { status: number; body: Record<string, unknown> }
export type Deps = { store: AuthStore | null; secret?: string; now?: () => number; send?: (to: string, code: string) => Promise<void>; random?: () => number }

export async function sendCode(email: string, ip: string, purpose: string, d: Deps): Promise<Res> {
  const e = email.trim().toLowerCase(); if (!GMAIL.test(e)) return { status: 400, body: { error: 'Use a Gmail address.' } }
  if (purpose !== 'register' && purpose !== 'login') return { status: 400, body: { error: 'Unknown purpose.' } }
  if (!d.store) return { status: 503, body: { error: STORE_MISSING } }
  if (!d.secret || !d.send) return { status: 503, body: { error: 'Gmail login is not configured yet. You can keep using ORI as a guest.' } }
  if (await d.store.hit('send:e:' + e, LIMITS.sendWindowSec) > LIMITS.sendPerEmail || await d.store.hit('send:ip:' + ip, LIMITS.sendWindowSec) > LIMITS.sendPerIp) return { status: 429, body: { error: 'Too many codes requested. Wait a few minutes and try again.' } }
  const now = (d.now || Date.now)(), rnd = d.random || (() => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] })
  const code = String(100000 + (rnd() % 900000)), jti = b64url(crypto.getRandomValues(new Uint8Array(16))), exp = now + LIMITS.codeTtlSec * 1000
  const payload = b64url(bytes(JSON.stringify({ e, p: purpose, exp, jti, h: await hmac(code + ':' + jti, d.secret) })))
  try { await d.send(e, code) } catch { return { status: 502, body: { error: 'The Gmail code could not be sent. Check the Gmail OAuth2 configuration.' } } }
  return { status: 200, body: { challenge: payload + '.' + await hmac(payload, d.secret), expiresAt: exp } }
}

export async function verifyCode(challenge: string, code: string, d: Deps): Promise<Res> {
  const bad: Res = { status: 400, body: { error: 'That code is invalid or expired.' } }
  if (!d.store) return { status: 503, body: { error: STORE_MISSING } }
  if (!d.secret) return { status: 503, body: { error: 'Gmail login is not configured yet.' } }
  const parts = String(challenge || '').split('.'); if (parts.length !== 2 || !/^\d{6}$/.test(String(code || ''))) return bad
  if (!same(await hmac(parts[0], d.secret), parts[1])) return bad
  let p: { e: string; p: string; exp: number; jti: string; h: string }; try { p = JSON.parse(fromB64url(parts[0])) } catch { return bad }
  if (!p.e || !p.jti || p.exp < (d.now || Date.now)()) return bad
  if (await d.store.hit('verify:' + p.jti, LIMITS.codeTtlSec) > LIMITS.verifyAttempts) return { status: 429, body: { error: 'Too many attempts. Request a new code.' } }
  if (!same(await hmac(code + ':' + p.jti, d.secret), p.h)) return bad
  if (!await d.store.consumeOnce('used:' + p.jti, LIMITS.codeTtlSec)) return bad // replay
  return { status: 200, body: { verified: true, email: p.e, purpose: p.p } }
}
