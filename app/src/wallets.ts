import { useEffect, useState } from 'react'
import { connectBaseWallet, connectPhantomWallet, type WalletConnection } from './live'

export type ManagedWallet = WalletConnection & { id: string; label: string; connectedAt: number }
const KEY = 'ori-external-wallets'
const ACTIVE = 'ori-active-wallet'
const makeId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `wallet_${Date.now()}_${Math.random().toString(36).slice(2)}`
export function loadWallets(): ManagedWallet[] { try { const r = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(r) ? r : [] } catch { return [] } }
export function activeWalletId(): string | null { return localStorage.getItem(ACTIVE) }
function publish() { dispatchEvent(new Event('ori-wallets')) }
export function saveWallet(w: WalletConnection, label = 'External wallet') { const current = loadWallets(); const existing = current.find(x => x.address.toLowerCase() === w.address.toLowerCase() && x.chain === w.chain); if (existing) { localStorage.setItem(ACTIVE, existing.id); publish(); return existing } const next: ManagedWallet = { ...w, id: makeId(), label, connectedAt: Date.now() }; localStorage.setItem(KEY, JSON.stringify([...current, next])); localStorage.setItem(ACTIVE, next.id); publish(); return next }
export function removeWallet(id: string) { const next = loadWallets().filter(w => w.id !== id); localStorage.setItem(KEY, JSON.stringify(next)); if (activeWalletId() === id) localStorage.setItem(ACTIVE, next[0]?.id || ''); publish() }
export function setActiveWallet(id: string) { if (loadWallets().some(w => w.id === id)) localStorage.setItem(ACTIVE, id); publish() }
export async function connectWallet(kind: 'evm' | 'sol') { const w = kind === 'evm' ? { address: await connectBaseWallet(), chain: 'evm' as const, network: 'Base', provider: 'EIP-1193 wallet' } : await connectPhantomWallet(); return saveWallet(w, kind === 'evm' ? 'EVM wallet' : 'Phantom wallet') }
export function useManagedWallets() { const [state, setState] = useState({ list: loadWallets(), active: activeWalletId() }); useEffect(() => { const f = () => setState({ list: loadWallets(), active: activeWalletId() }); addEventListener('ori-wallets', f); return () => removeEventListener('ori-wallets', f) }, []); return state }
