import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { short } from './live'
import { type Transaction, useTransactions } from './transactions'
import { txAmountLabel, txStatusLabel } from './historyLabels'

const ago = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const icon = (t: Transaction['kind']) => t === 'receive' ? '↓' : t === 'create' ? '+' : t === 'swap' ? '⇄' : '↑'

export function TransactionDetail({ tx, onClose }: { tx: Transaction | null; onClose: () => void }) {
  if (!tx) return null
  return <AnimatePresence><motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
    <motion.div className="tx-detail" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} onClick={e => e.stopPropagation()}>
      <div className="tx-detail-head"><div><b>{tx.kind[0].toUpperCase() + tx.kind.slice(1)}{tx.demo && <span className="example" style={{ marginLeft: 8 }}>DEMO</span>}</b><span className="sub">{new Date(tx.at).toLocaleString('en-GB')}</span></div><button onClick={onClose} aria-label="Close transaction">×</button></div>
      <div className={'tx-amount' + (tx.demo ? ' dim' : tx.amount.startsWith('+') ? ' positive' : '')}><span className="tx-coin">{icon(tx.kind)}</span>{txAmountLabel(tx)}</div>
      <div className="tx-rule" />
      <div className="tx-field"><b>Status</b><strong className={tx.demo ? '' : tx.status === 'completed' ? 'positive' : tx.status === 'failed' || tx.status === 'cancelled' ? 'negative' : ''}>{txStatusLabel(tx)}</strong></div>
      <div className="tx-field"><b>Network</b><span>{tx.network}</span></div>
      {tx.to && <div className="tx-field"><b>To</b><span className="mono tx-address">{tx.to}</span></div>}
      {tx.from && <div className="tx-field"><b>From</b><span className="mono tx-address">{tx.from}</span></div>}
      {tx.note && <div className="tx-field"><b>Note</b><span>{tx.note}</span></div>}
      {tx.txHash && !tx.demo && <div className="tx-field"><b>Transaction</b><span className="mono tx-address">{short(tx.txHash)}</span></div>}
      {tx.explorer && !tx.demo && <a className="cta explorer" href={tx.explorer} target="_blank" rel="noreferrer">Check on blockchain explorer</a>}
    </motion.div></AnimatePresence>
}

function TxRow({ tx, compact, onSelect }: { tx: Transaction; compact?: boolean; onSelect: (tx: Transaction) => void }) {
  return <button className={'tx-row' + (compact ? ' compact' : '')} key={tx.id} onClick={() => onSelect(tx)}>
    <span className="tx-icon">{icon(tx.kind)}</span>
    <span className="grow">
      <b>{tx.kind[0].toUpperCase() + tx.kind.slice(1)}{tx.demo && <span className="example" style={{ marginLeft: 6 }}>DEMO</span>}</b>
      <span className="sub">{tx.to ? `To ${short(tx.to)}` : tx.note || tx.network}{compact ? '' : ` · ${ago(tx.at)}`}</span>
    </span>
    <span className={'tx-right' + (tx.demo ? ' dim' : tx.amount.startsWith('+') ? ' positive' : '')}>
      {txAmountLabel(tx)}
      {!compact && <small>{txStatusLabel(tx)}</small>}
    </span>
  </button>
}

export function HistoryScreen({ onSelect }: { onSelect: (tx: Transaction) => void }) {
  const list = useTransactions(); const [filter, setFilter] = useState<'all' | Transaction['kind']>('all')
  const shown = filter === 'all' ? list : list.filter(t => t.kind === filter)
  return <div className="pg history-page"><section className="pad-top"><div className="sechead"><div><div className="label">HISTORY</div><h2 className="big2">Your activity.</h2></div><select className="history-filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">All types</option><option value="send">Send</option><option value="receive">Receive</option><option value="swap">Swap</option><option value="create">Create</option></select></div></section>
    <section>{shown.map(tx => <TxRow key={tx.id} tx={tx} onSelect={onSelect} />)}{!shown.length && <div className="mono xs dim">No transactions yet.</div>}</section>
  </div>
}

export function RecentTransactions({ max = 4, onSelect }: { max?: number; onSelect: (tx: Transaction) => void }) {
  const list = useTransactions().slice(0, max)
  return <>{list.map(tx => <TxRow key={tx.id} tx={tx} compact onSelect={onSelect} />)}</>
}
