import { useEffect, useState } from 'react'
// Local-only preferences. Nothing leaves the browser.
export type Fmt = 'full' | 'nocents' | 'compact'
export type Settings = {
  voice: boolean; voiceOptIn?: boolean; wake: boolean; rate: number; fmt: Fmt; reduce: boolean
  scam: boolean; daily: number; perPay: number; holdAbove: number; trusted: string[]
}
export const DEFAULTS: Settings = { voice: false, wake: true, rate: 1.02, fmt: 'full', reduce: false, scam: true, daily: 500, perPay: 250, holdAbove: 20, trusted: ['@tolu', '@ade'] }
const KEY = 'ori-settings'
export function loadSettings(): Settings { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); if (!o.voiceOptIn) o.voice = false; return { ...DEFAULTS, ...o } } catch { return DEFAULTS } }
export function useSettings(): [Settings, (p: Partial<Settings>) => void] {
  const [s, setS] = useState(loadSettings)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(s)) }, [s])
  return [s, p => setS(o => ({ ...o, ...p }))]
}
// formatting follows the currency-display setting
let FMT: Fmt = loadSettings().fmt
export const setFmt = (f: Fmt) => { FMT = f }
export const getFmt = () => FMT
export const usd = (n: number) => FMT === 'compact' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
  : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: FMT === 'nocents' ? 0 : 2, minimumFractionDigits: FMT === 'nocents' ? 0 : 2 })
// spend ledger (simulated) for daily cap, per local day
const SKEY = 'ori-spent'
const today = () => new Date().toDateString()
export function spentToday(): number { try { const o = JSON.parse(localStorage.getItem(SKEY) || '{}'); return o.d === today() ? o.v : 0 } catch { return 0 } }
export function addSpent(v: number) { localStorage.setItem(SKEY, JSON.stringify({ d: today(), v: spentToday() + v })) }
// blocked attempts log
export type Blocked = { at: number; what: string; why: string }
const BKEY = 'ori-blocked'
export function blockedLog(): Blocked[] { try { return JSON.parse(localStorage.getItem(BKEY) || '[]') } catch { return [] } }
export function logBlocked(what: string, why: string) {
  const l = blockedLog(); if (l[0] && l[0].what === what && l[0].why === why && Date.now() - l[0].at < 60000) return
  localStorage.setItem(BKEY, JSON.stringify([{ at: Date.now(), what, why }, ...l].slice(0, 30))); dispatchEvent(new Event('ori-blocked'))
  logEvent(/cap|limit/i.test(why) ? 'block' : 'flag', /cap|limit/i.test(why) ? 'Ori blocked a send over your limit' : 'Ori blocked a flagged recipient', `${what} · ${why}`)
}
export function limitCheck(s: Settings, amt: number): string | null {
  if (amt > s.perPay) return `Over your per-payment cap of ${usd(s.perPay)}.`
  const left = s.daily - spentToday()
  if (amt > left) return `That would pass your daily cap of ${usd(s.daily)} (${usd(Math.max(left, 0))} left today).`
  return null
}
export function resetLocal() { ['ori-settings', SKEY, BKEY, 'ori-feed', 'ori-revoked', 'ori-transactions', 'ori-account', 'ori-usernames', 'mode', 'addrs', 'ori-intro'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k) }); ['ori-guest', 'ori-account-prompted'].forEach(k => sessionStorage.removeItem(k)) }
// Ori activity feed (local). Real policy events are appended; a few demo entries are seeded.
export type FeedKind = 'flag' | 'block' | 'approve' | 'revoke' | 'info'
export type FeedItem = { at: number; kind: FeedKind; text: string; sub?: string; demo?: boolean }
const FKEY = 'ori-feed'
function seed(): FeedItem[] {
  const n = Date.now(), h = 3600e3
  return [
    { at: n - 0.6 * h, kind: 'flag', text: 'Ori flagged a suspicious token', sub: 'USDC-CLAIM airdrop on Base · impersonates USDC, can’t be sold', demo: true },
    { at: n - 3 * h, kind: 'approve', text: 'Ori approved a send to an allowlisted contact', sub: '$50.00 to @tolu · under your limits', demo: true },
    { at: n - 20 * h, kind: 'block', text: 'Ori blocked a send over your limit', sub: '$400.00 to @kemi · per-transaction cap $250.00', demo: true },
    { at: n - 26 * h, kind: 'flag', text: 'Ori flagged an unlimited approval', sub: 'USDC on Ethereum · spender flagged by GoPlus', demo: true },
  ]
}
export function feed(): FeedItem[] { try { const r = localStorage.getItem(FKEY); if (r) return JSON.parse(r) } catch { } const s = seed(); localStorage.setItem(FKEY, JSON.stringify(s)); return s }
export function logEvent(kind: FeedKind, text: string, sub?: string) {
  const l = feed(); if (l[0] && l[0].text === text && l[0].sub === sub && Date.now() - l[0].at < 30000) return
  localStorage.setItem(FKEY, JSON.stringify([{ at: Date.now(), kind, text, sub }, ...l].slice(0, 40))); dispatchEvent(new Event('ori-feed'))
}
export function useFeed() { const [f, setF] = useState(feed); useEffect(() => { const g = () => setF(feed()); addEventListener('ori-feed', g); return () => removeEventListener('ori-feed', g) }, []); return f }
// demo token approvals + revokes
export type Approval = { id: string; token: string; chain: string; spender: string; name: string; amount: 'Unlimited' | number; risk: string | null }
export const APPROVALS: Approval[] = [
  { id: 'a1', token: 'USDC', chain: 'Ethereum', spender: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', name: 'Unknown contract', amount: 'Unlimited', risk: 'Unlimited allowance to an address GoPlus links to theft and phishing' },
  { id: 'a2', token: 'USDC', chain: 'Base', spender: '0x2626664c2603336E57B271c5C0b26F421741e481', name: 'Uniswap V3 Router', amount: 'Unlimited', risk: 'Unlimited allowance. Known protocol, but a cap is safer' },
  { id: 'a3', token: 'USDT', chain: 'Ethereum', spender: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', name: 'Aave v3 Pool', amount: 200, risk: null },
]
const RKEY = 'ori-revoked'
export function revoked(): string[] { try { return JSON.parse(localStorage.getItem(RKEY) || '[]') } catch { return [] } }
export function revoke(id: string) { localStorage.setItem(RKEY, JSON.stringify([...new Set([...revoked(), id])])) }
export const SUSPICIOUS = [{ sym: 'USDC-CLAIM', chain: 'Base', amt: 5000, why: 'Unsolicited airdrop · name impersonates USDC · sell is disabled (honeypot) · links to a “claim” site' }]
