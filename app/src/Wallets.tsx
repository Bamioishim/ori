import { useEffect, useMemo, useState } from 'react'
import { readPortfolio, short, type Holding } from './live'
import { connectWallet, removeWallet, setActiveWallet, useManagedWallets } from './wallets'
import { Dots } from './Loaders'

const total = (h: Holding[]) => h.reduce((n, x) => n + x.usd, 0)
export default function WalletsScreen() {
  const { list, active } = useManagedWallets(); const [busy, setBusy] = useState<'evm' | 'sol' | null>(null); const [error, setError] = useState(''); const [holdings, setHoldings] = useState<Holding[]>([]); const [readError, setReadError] = useState('')
  const selected = list.find(w => w.id === active) || list[0]
  useEffect(() => { let dead = false; setHoldings([]); setReadError(''); if (!selected) return; readPortfolio([selected.address]).then(r => { if (!dead) { setHoldings(r.holdings); setReadError(r.errors.join(' · ')) } }).catch(e => { if (!dead) setReadError((e as Error).message) }); return () => { dead = true } }, [selected?.id, selected?.address])
  const byChain = useMemo(() => holdings.filter(h => h.amt > 0), [holdings])
  const connect = async (kind: 'evm' | 'sol') => { setBusy(kind); setError(''); try { await connectWallet(kind) } catch (e) { setError((e as Error).message) } finally { setBusy(null) } }
  return <div className="pg wallets-page"><section className="pad-top"><div className="label">WALLETS · NON-CUSTODIAL</div><h2 className="big2">Your wallets,<br /><span className="dim">your keys.</span></h2><p className="account-copy">Connect external wallets without giving ORI private keys or recovery phrases. ORI stores only public addresses and provider metadata on this device.</p>
    <div className="wallet-connect"><button className="cta compact" disabled={!!busy} onClick={() => connect('evm')}>{busy === 'evm' ? <Dots size={5} label="Connecting" /> : 'Connect MetaMask / Coinbase'}</button><button className="ghost" disabled={!!busy} onClick={() => connect('sol')}>{busy === 'sol' ? <Dots size={5} label="Connecting" /> : 'Connect Phantom'}</button></div>{error && <div className="mono xs err why">{error}</div>}</section>
    <section><div className="sechead"><div className="label">CONNECTED WALLETS</div><span className="mono xs dim">{list.length} wallet{list.length === 1 ? '' : 's'}</span></div>{list.length ? list.map(w => <div className={'wallet-card ' + (w.id === (active || list[0]?.id) ? 'selected' : '')} key={w.id}>
      <button className="wallet-main" onClick={() => setActiveWallet(w.id)}><span className="wallet-mark">{w.chain === 'sol' ? 'S' : 'E'}</span><span className="grow"><b>{w.label}</b><span className="sub">{w.network} · {short(w.address)}</span></span><span className="mono xs">{w.id === (active || list[0]?.id) ? 'ACTIVE' : 'USE'}</span></button><button className="mono xs dim wallet-remove" onClick={() => removeWallet(w.id)}>DISCONNECT</button>
    </div>) : <div className="mono xs dim">No external wallets connected.</div>}</section>
    {selected && <section><div className="sechead"><div className="label">ACTIVE WALLET BALANCES</div><span className="num">${total(byChain).toFixed(2)}</span></div>{byChain.length ? byChain.map((h, i) => <div className="row" key={h.sym + h.chain + i}><span className="grow"><b>{h.sym}</b><span className="sub">{h.chain}</span></span><span className="num">{h.amt.toLocaleString('en-US', { maximumFractionDigits: 6 })}<span className="sub">${h.usd.toFixed(2)}</span></span></div>) : <div className="mono xs dim">{readError || 'Reading public balances…'}</div>}{readError && byChain.length > 0 && <div className="mono xs err why">{readError}</div>}</section>}
    <section><div className="label">SELF-CUSTODY VAULT</div><div className="row"><span className="grow"><b>Create or import a wallet</b><span className="sub">Seed/private-key import and export are unavailable until the encrypted vault, authentication, recovery, and session-security design is reviewed.</span></span><span className="mono xs dim">PLANNED</span></div><div className="mono xs dim">Never paste a recovery phrase or private key into this preview. External connections remain non-custodial.</div></section>
  </div>
}
