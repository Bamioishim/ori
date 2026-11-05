import { useState, type FormEvent } from 'react'
import { kindOf } from './live'
import { CHAIN_LOGOS } from './tokenLogos'
import { useManagedWallets } from './wallets'
import { formatCopyAll, receiveDirectory, validateReceiveAddress, type AddrKind, type ReceiveNetwork } from './receiveTargets'
import type { Settings } from './settings'

const CHAIN_COL: Record<string, string> = { Base: '#7F9BB8', Solana: '#9C8AAE', Ethereum: '#8E98A6', NEAR: '#8FA88A' }
const CURRENCIES = ['USDC', 'USDT', 'ETH', 'SOL']
const classify = (a: string): AddrKind | null => {
  const k = kindOf(a)
  return k === 'evm' || k === 'sol' || k === 'near' ? k : null
}

export function ReceiveScreen({ watched, cfg, setCfg, openWallets, onAddWatch }: {
  watched: string[]
  cfg: Settings
  setCfg: (p: Partial<Settings>) => void
  openWallets: () => void
  onAddWatch: (address: string) => void
}) {
  const { list } = useManagedWallets()
  const rows = receiveDirectory(list, watched, classify)
  const blob = formatCopyAll(rows)
  const [copied, setCopied] = useState('')
  const [adding, setAdding] = useState<ReceiveNetwork | null>(null)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1600) }).catch(() => setCopied(''))
  }

  const add = (e: FormEvent, network: ReceiveNetwork) => {
    e.preventDefault()
    const msg = validateReceiveAddress(network, draft)
    if (msg) { setErr(msg); return }
    onAddWatch(draft.trim())
    setAdding(null); setDraft(''); setErr('')
  }

  return <div className="pg receive-pg">
    <section className="pad-top">
      <p className="label">RECEIVE</p>
      <h2 className="big2">Your addresses</h2>
      <p className="mono xs dim">Copy a real address on Base, Ethereum, Solana or NEAR. ORI never invents keys or demo placeholders. A pasted address is watch-only — ORI does not verify that you own it.</p>
    </section>
    <section>
      {rows.map(row => {
        const missing = !row.copyable || !row.address
        return <div className="row col" key={row.network}>
          <div className="prow">
            <span className="pchip" style={{ background: CHAIN_COL[row.network] }} aria-hidden>
              {CHAIN_LOGOS[row.network] && <img src={CHAIN_LOGOS[row.network]} alt="" onError={e => e.currentTarget.remove()} />}
            </span>
            <span className="grow">{row.network}</span>
          </div>
          {missing ? <>
            <span className="mono xs dim">{row.kind === 'near' ? 'No address added' : 'Not connected'}</span>
            <span className="rowbtns">
              {row.kind !== 'near' && <button type="button" className="ghost" onClick={openWallets}>Connect a wallet</button>}
              <button type="button" className="ghost" onClick={() => { setAdding(row.network); setDraft(''); setErr('') }}>Add existing address</button>
            </span>
            {adding === row.network && <form onSubmit={e => add(e, row.network)}>
              <input className="field" value={draft} onChange={e => { setDraft(e.target.value); setErr('') }} placeholder={row.kind === 'near' ? 'existing-account.near' : row.kind === 'sol' ? 'Existing Solana address' : '0x… existing address'} autoComplete="off" spellCheck={false} />
              {err && <p className="mono xs dim">{err}</p>}
              <span className="rowbtns">
                <button type="submit" className="ghost">Save as watch-only</button>
                <button type="button" className="ghost" onClick={() => { setAdding(null); setErr('') }}>Cancel</button>
              </span>
            </form>}
          </> : <>
            <span className="mono xs">{row.address}</span>
            <span className="mono xs dim">{row.source === 'watched' ? 'Manually added · watch-only (ORI does not verify you own this address)' : 'Connected wallet'}</span>
            {row.kind === 'evm' && <span className="mono xs dim">Same EVM address can receive on Base and Ethereum. Send the matching asset on this network — Base USDC is not Ethereum USDC.</span>}
            <button type="button" className="ghost" onClick={() => copy(row.address!, row.network)} aria-label={`Copy ${row.network} address`}>{copied === row.network ? 'Copied' : `Copy ${row.network} address`}</button>
          </>}
        </div>
      })}
      {blob && <button type="button" className="ghost" onClick={() => copy(blob, 'all')}>{copied === 'all' ? 'Copied' : 'Copy populated addresses'}</button>}
      <p className="mono xs dim">NEAR has no in-app connector. You can receive to an existing NEAR account; sending from ORI on NEAR is not available yet. Connect a wallet to add a new Base, Ethereum or Solana account, or paste one you already have.</p>
    </section>
    <section>
      <div className="row"><span className="grow">Preferred receiving currency<br /><span className="mono xs dim">Recipients keep this default until they change it. Routes are shown only when supported.</span></span>
        <select className="history-filter" value={cfg.preferredReceivingCurrency} onChange={e => setCfg({ preferredReceivingCurrency: e.target.value })} aria-label="Preferred receiving currency">{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
    </section>
  </div>
}
