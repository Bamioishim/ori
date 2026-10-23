import { useEffect, useState } from 'react'
// Local-only preferences. Nothing leaves the browser.
export type Fmt = 'full' | 'nocents' | 'compact'
export type Settings = {
  voice: boolean; wake: boolean; rate: number; fmt: Fmt; reduce: boolean
  scam: boolean; daily: number; perPay: number; holdAbove: number; trusted: string[]
}
export const DEFAULTS: Settings = { voice: true, wake: true, rate: 1.02, fmt: 'full', reduce: false, scam: true, daily: 500, perPay: 250, holdAbove: 20, trusted: ['@tolu', '@ade'] }
const KEY = 'ori-settings'
export function loadSettings(): Settings { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS } }
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
}
export function limitCheck(s: Settings, amt: number): string | null {
  if (amt > s.perPay) return `Over your per-payment cap of ${usd(s.perPay)}.`
  const left = s.daily - spentToday()
  if (amt > left) return `That would pass your daily cap of ${usd(s.daily)} (${usd(Math.max(left, 0))} left today).`
  return null
}
export function resetLocal() { ['ori-settings', SKEY, BKEY, 'mode', 'addrs', 'ori-intro'].forEach(k => { localStorage.removeItem(k); sessionStorage.removeItem(k) }) }
