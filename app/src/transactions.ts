import { useEffect, useState } from 'react'

export type Transaction = {
  id: string
  kind: 'send' | 'receive' | 'swap' | 'create'
  at: number
  status: 'completed' | 'submitted' | 'pending' | 'failed' | 'cancelled'
  amount: string
  asset: string
  network: string
  to?: string
  from?: string
  note?: string
  txHash?: string
  explorer?: string
  demo?: boolean
}
const KEY = 'ori-transactions'
const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
function seed(): Transaction[] {
  const n = Date.now(), d = 864e5
  return [
    { id: 'demo-send-sol', kind: 'send', at: n - 3 * d, status: 'completed', amount: '-0.014341', asset: 'SOL', network: 'Solana', to: 'BYWzAHbD38RvEihmJgy7E95CMKJ3mLXy3tEEs48cPaQx', note: 'Wallet A - Bamio', demo: true },
    { id: 'demo-send-usdc', kind: 'send', at: n - 8 * d, status: 'completed', amount: '-8', asset: 'USDC', network: 'Solana', to: 'HPhokKW…E8DT', demo: true },
    { id: 'demo-create-sol', kind: 'create', at: n - 9 * d, status: 'completed', amount: '+0.001488', asset: 'SOL', network: 'Solana', note: 'Created account', demo: true },
  ]
}
export function transactions(): Transaction[] { try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(r)) return r } catch { /* */ } const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s }
export function logTransaction(t: Omit<Transaction, 'id' | 'at'> & { id?: string; at?: number }) { const next = { ...t, id: t.id || id(), at: t.at || Date.now() }; localStorage.setItem(KEY, JSON.stringify([next, ...transactions()].slice(0, 100))); dispatchEvent(new Event('ori-transactions')); return next }
export function updateTransaction(id: string, patch: Partial<Omit<Transaction, 'id' | 'at'>>) {
  const next = transactions().map(t => t.id === id ? { ...t, ...patch } : t)
  localStorage.setItem(KEY, JSON.stringify(next)); dispatchEvent(new Event('ori-transactions'))
  return next.find(t => t.id === id) || null
}
export function useTransactions() { const [list, setList] = useState(transactions); useEffect(() => { const f = () => setList(transactions()); addEventListener('ori-transactions', f); return () => removeEventListener('ori-transactions', f) }, []); return list }
