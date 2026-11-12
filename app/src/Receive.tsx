import { CopyButton } from './ui'
import { useState, type FormEvent } from 'react'
import { kindOf } from './live'
import { CHAIN_LOGOS } from './tokenLogos'
import { useManagedWallets } from './wallets'
import { formatCopyAll, receiveDirectory, validateReceiveAddress, type AddrKind, type ReceiveNetwork } from './receiveTargets'
import type { Settings } from './settings'
import { NativeWalletCard, useNativeWallet } from './NativeWallet'

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
  const native = useNativeWallet()
  const rows = receiveDirectory(list, watched, classify, native ? { near: native.nearAccountId, evm: native.evm?.address ?? null, sol: native.sol?.address ?? null, errors: native.errors } : null)
  const blob = formatCopyAll(rows)
  const [adding, setAdding] = useState<ReceiveNetwork | null>(null)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')


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
    <NativeWalletCard compact />
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
            <span className="mono xs dim">{row.nativeError ? `ORI wallet address unavailable on ${row.network} (${row.nativeError}). Nothing to copy yet.` : row.kind === 'near' ? 'No address added' : 'Not connected'}</span>
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
            <span className="mono xs dim">{row.source === 'native' ? (row.kind === 'near' ? 'ORI wallet · receive-only · NEAR Auth implicit account (activates on first NEAR received)' : 'ORI wallet · receive-only · Chain Signatures (derived from your NEAR Auth account)') : row.source === 'watched' ? 'Manually added · watch-only (ORI does not verify you own this address)' : 'Connected wallet'}</span>
            {row.kind === 'evm' && <span className="mono xs dim">Same EVM address can receive on Base and Ethereum. Send the matching asset on this network — Base USDC is not Ethereum USDC.</span>}
            <CopyButton text={row.address!} label={`Copy ${row.network} address`} aria={`Copy ${row.network} address`} />
          </>}
        </div>
      })}
      {blob && <CopyButton text={blob} label="Copy populated addresses" />}
      <p className="mono xs dim">{native ? 'Your ORI wallet addresses come from your NEAR Auth login through NEAR Chain Signatures (MPC signer v1.signer). They are receive-only for now: sending from them (including NEAR) needs a NEAR signing relayer that is not set up yet. Funds sent here stay safe and become spendable once signing is enabled.' : 'Create your ORI wallet above to get your own address on every chain, or connect a wallet / paste an address you already have.'}</p>
    </section>
    <section>
      <div className="row"><span className="grow">Preferred receiving currency<br /><span className="mono xs dim">Recipients keep this default until they change it. Routes are shown only when supported.</span></span>
        <select className="history-filter" value={cfg.preferredReceivingCurrency} onChange={e => setCfg({ preferredReceivingCurrency: e.target.value })} aria-label="Preferred receiving currency">{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
    </section>
  </div>
}
