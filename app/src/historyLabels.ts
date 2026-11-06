import type { Transaction } from './transactions.ts'

/** List/detail: demo must not read as a real completed debit. */
export function txAmountLabel(tx: Pick<Transaction, 'amount' | 'asset' | 'demo'>): string {
  if (tx.demo) {
    const n = tx.amount.replace(/^[+-]/, '')
    return `${n} ${tx.asset} · simulated`
  }
  return `${tx.amount} ${tx.asset}`
}
export function txStatusLabel(tx: Pick<Transaction, 'status' | 'demo'>): string {
  if (tx.demo) return 'DEMO · simulated'
  return tx.status[0].toUpperCase() + tx.status.slice(1)
}
