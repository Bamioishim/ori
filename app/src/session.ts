import type { Account } from './Account'
export const KNOWN = 'ori-known-profiles'
export const knownProfiles = (): Account[] => { try { const r = JSON.parse(localStorage.getItem(KNOWN) || '[]'); return Array.isArray(r) ? r : [] } catch { return [] } }
// Sign out ends the session only. The profile stays on this device so the emailed code can sign back in,
// and wallets, history and settings are untouched (ORI never stores wallet keys).
export function signOut() { try { const a = JSON.parse(localStorage.getItem('ori-account') || 'null') as Account | null; if (a?.email) localStorage.setItem(KNOWN, JSON.stringify([a, ...knownProfiles().filter(p => p.email !== a.email)].slice(0, 5))) } catch { /* ignore */ } localStorage.removeItem('ori-account') }
