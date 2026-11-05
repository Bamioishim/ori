import { useState } from 'react'
import { kindOf, short } from './live'
import { useManagedWallets } from './wallets'
import { receiveTargets } from './receiveTargets'
import type { Settings } from './settings'

const CURRENCIES = ['USDC', 'USDT', 'ETH', 'SOL']
export function ReceiveScreen({ watched, live, cfg, setCfg, openWallets }: { watched: string[]; live: boolean; cfg: Settings; setCfg: (p: Partial<Settings>) => void; openWallets: () => void }) {
  const { list } = useManagedWallets()
  const targets = receiveTargets(list, live ? watched : [], kindOf)
  const nets = [...new Set(targets.flatMap(t => t.networks))]
  const [net, setNet] = useState<string>('')
  const sel = net && nets.includes(net) ? net : nets[0] || ''
  const [copied, setCopied] = useState('')
  const copy = (a: string) => { navigator.clipboard?.writeText(a).then(() => { setCopied(a); setTimeout(() => setCopied(''), 1400) }).catch(() => setCopied('')) }
  return <div className="pg">
    <section className="pad-top"><h2 className="big2">Receive<br /><span className="dim">to your own address.</span></h2>
      <div className="mono xs dim">Anyone can send from any wallet; they don’t need ORI. Send only on the network shown, or funds can be lost.</div></section>
    <section><div className="row"><span className="grow">Preferred receiving currency<br /><span className="mono xs dim">Same setting as Settings → Payments. Routes are shown only when supported.</span></span>
      <select className="history-filter" value={cfg.preferredReceivingCurrency} onChange={e => setCfg({ preferredReceivingCurrency: e.target.value })} aria-label="Preferred receiving currency">{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div></section>
    {!targets.length ? <section><div className="mono xs dim why">No receiving address yet. Connect a wallet{live ? ' or add an address in Settings' : ''} to show your real addresses here. ORI never shows example addresses for receiving.</div>
      <button className="cta" onClick={openWallets}>Connect a wallet</button></section>
      : <section>
        <div className="row"><span className="grow">Network</span>
          <select className="history-filter" value={sel} onChange={e => setNet(e.target.value)} aria-label="Network">{nets.map(n => <option key={n}>{n}</option>)}</select></div>
        {targets.filter(t => t.networks.includes(sel)).map(t => <div className="row" key={t.kind + t.address}>
          <span className="grow">{sel} · {t.label}<br /><span className="mono xs dim" title={t.address}>{short(t.address)}</span>{t.kind === 'evm' && <><br /><span className="mono xs dim">Same address on Base and Ethereum. Choose the network the sender uses.</span></>}</span>
          <button className="ghost" onClick={() => copy(t.address)} aria-label={`Copy ${sel} address`}>{copied === t.address ? 'Copied' : 'Copy'}</button></div>)}
      </section>}
  </div>
}
