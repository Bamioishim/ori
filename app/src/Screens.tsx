import { PillTabs } from './ui'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { goplus, kindOf, short, type Risk } from './live'
import { blockedLog, resetLocal, spentToday, usd, type Blocked, type Fmt, type Settings } from './settings'
import { Dots } from './Loaders'
const spring = { type: 'spring' as const, stiffness: 420, damping: 32 }
function Label({ children }: { children: React.ReactNode }) { return <div className="label">{children}</div> }
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button className={'tg' + (on ? ' on' : '')} onClick={() => onChange(!on)} aria-pressed={on} aria-label={label}><motion.span layout transition={spring} /></button>
}
function Seg<T extends string | number>({ v, opts, onChange }: { v: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return <PillTabs id={'seg' + opts.map(o => o[0]).join()} role="radiogroup" className="modes seg" value={v} options={opts} onChange={onChange} />
}
function Num({ v, onChange, step = 10 }: { v: number; onChange: (n: number) => void; step?: number }) {
  return <span className="numin"><button onClick={() => onChange(Math.max(0, v - step))} aria-label="Decrease">−</button><span className="mono">$<input value={v} inputMode="decimal" onChange={e => onChange(+e.target.value.replace(/[^\d.]/g, '') || 0)} /></span><button onClick={() => onChange(v + step)} aria-label="Increase">+</button></span>
}
type P = { s: Settings; set: (p: Partial<Settings>) => void }

export function SettingsScreen({ s, set, mode, setMode, watch }: P & { mode: 'example' | 'live'; setMode: (m: 'example' | 'live') => void; watch: React.ReactNode }) {
  const [sure, setSure] = useState(false)
  return <div className="pg">
    <section className="pad-top"><Label>SETTINGS · STORED ON THIS DEVICE</Label><h2 className="big2">Your ORI,<br /><span className="dim">your rules.</span></h2>
      <div className="row"><span className="grow">Data mode<br /><span className="mono xs dim">Example data, or real balances read from your watched addresses</span></span>
        <Seg v={mode} opts={[['example', 'Example'], ['live', 'Live · watch-only']]} onChange={setMode} /></div></section>
    <section>{watch}</section>
    <section><Label>PAYMENTS</Label>
      <div className="row"><span className="grow">Preferred receiving currency<br /><span className="mono xs dim">Recipients keep this default until they change it. Routes are shown only when supported.</span></span>
        <select className="history-filter" value={s.preferredReceivingCurrency} onChange={e => set({ preferredReceivingCurrency: e.target.value })}><option>USDC</option><option>USDT</option><option>ETH</option><option>SOL</option></select></div>
      <div className="mono xs dim">ORI will not assume that every token or network is available through NEAR Intents.</div></section>
    <section><Label>VOICE</Label>
      <div className="row"><span className="grow">Ori speaks replies<br /><span className="mono xs dim">Off by default. Opt in to hear chat replies read aloud</span></span><Toggle on={s.voice} onChange={v => set({ voice: v, voiceOptIn: true })} label="Voice" /></div>
      <div className="row"><span className="grow">“Hey ORI”<br /><span className="mono xs dim">Tap Hey ORI to open chat and speak for that gesture only. There is no always-on wake word. You can type if voice isn’t available; spoken replies stay opt-in. Support varies, especially on iOS Safari.</span></span></div>
      <div className="row col"><span className="grow">Ori voice speed <b className="num">{s.rate.toFixed(2)}×</b></span><input type="range" min={0.7} max={1.6} step={0.01} value={s.rate} onChange={e => set({ rate: +e.target.value })} /></div></section>
    <section><Label>DISPLAY</Label>
      <div className="row"><span className="grow">Currency display<br /><span className="mono xs dim">{usd(2857.69)}</span></span><Seg<Fmt> v={s.fmt} opts={[['full', '$1,234.56'], ['nocents', '$1,235'], ['compact', '$1.2K']]} onChange={v => set({ fmt: v })} /></div>
      <div className="row"><span className="grow">Reduce motion<br /><span className="mono xs dim">Calms Ori, the dust and the transitions. Your system setting is always respected</span></span><Toggle on={s.reduce} onChange={v => set({ reduce: v })} label="Reduce motion" /></div></section>
    <section><Label>LOCAL DATA</Label>
      <div className="row"><span className="grow">Reset everything on this device<br /><span className="mono xs dim">Settings, watched addresses, limits, the spend ledger and the blocked log</span></span>
        {sure ? <span className="rowbtns"><button className="ghost" onClick={() => setSure(false)}>Cancel</button><button className="ghost danger" onClick={() => { resetLocal(); location.reload() }}>Reset</button></span> : <button className="ghost" onClick={() => setSure(true)}>Reset…</button>}</div></section>
  </div>
}

export function SecurityScreen({ s, set }: P) {
  const [addr, setAddr] = useState(''); const [res, setRes] = useState<Risk | null>(null); const [busy, setBusy] = useState(false)
  const [who, setWho] = useState('')
  const [log, setLog] = useState<Blocked[]>(blockedLog)
  useEffect(() => { const f = () => setLog(blockedLog()); addEventListener('ori-blocked', f); return () => removeEventListener('ori-blocked', f) }, [])
  const spent = spentToday()
  const run = async () => { if (!addr.trim()) return; setBusy(true); setRes(null); setRes(await goplus(addr.trim())); setBusy(false) }
  const k = kindOf(addr.trim())
  return <div className="pg">
    <section className="pad-top"><Label>SECURITY</Label><h2 className="big2">Nothing leaves<br /><span className="dim">without passing here.</span></h2>
      <div className="row"><span className="grow">Scam check on every payment<br /><span className="mono xs dim">GoPlus address security, live · {s.scam ? 'ON · recommended' : 'OFF · payments go unchecked'}</span></span><Toggle on={s.scam} onChange={v => set({ scam: v })} label="Scam check" /></div></section>
    <section><Label>SPENDING LIMITS · IN-APP</Label>
      <div className="mono xs dim">Checked in this ORI app right before it asks your wallet to sign, for payments and swaps started in ORI. Not enforced on a server, NEAR contract or Chain Signatures, and stored on this device, so clearing site data resets it. Limits do not govern your external wallet: anything signed outside ORI is not covered.</div>
      <div className="row"><span className="grow">Daily cap<br /><span className="mono xs dim">{usd(spent)} used today (simulated) · {usd(Math.max(0, s.daily - spent))} left</span></span><Num v={s.daily} onChange={v => set({ daily: v })} step={50} /></div>
      <div className="meter"><i style={{ width: Math.min(100, spent / (s.daily || 1) * 100) + '%' }} /></div>
      <div className="row"><span className="grow">Per-payment cap</span><Num v={s.perPay} onChange={v => set({ perPay: v })} step={25} /></div>
      <div className="row"><span className="grow">Require hold-to-confirm above<br /><span className="mono xs dim">Below this, a single tap confirms</span></span><Num v={s.holdAbove} onChange={v => set({ holdAbove: v })} step={5} /></div></section>
    <section><Label>TRUSTED CONTACTS</Label>
      {s.trusted.map(t => <div className="row" key={t}><span className="grow">{t}</span><span className="mono xs dim">TRUSTED</span><button className="mono xs dim" onClick={() => set({ trusted: s.trusted.filter(x => x !== t) })}>REMOVE</button></div>)}
      <form className="addaddr" onSubmit={e => { e.preventDefault(); const w = who.trim(); if (w && !s.trusted.includes(w)) { set({ trusted: [...s.trusted, w] }); setWho('') } }}>
        <input value={who} onChange={e => setWho(e.target.value)} placeholder="@handle or address" spellCheck={false} /><button className="mono xs" disabled={!who.trim()}>ADD</button></form>
      <div className="mono xs dim">Trusted contacts skip the “new recipient” warning. Scam checks still run.</div></section>
    <section><Label>CHECK ANY ADDRESS · GOPLUS LIVE</Label>
      <form className="addaddr" onSubmit={e => { e.preventDefault(); run() }}>
        <input value={addr} onChange={e => { setAddr(e.target.value); setRes(null) }} placeholder="Paste 0x… address" spellCheck={false} /><button className="mono xs" disabled={!addr.trim() || busy}>{busy ? <Dots size={4} /> : 'CHECK'}</button></form>
      <AnimatePresence mode="wait">{res && <motion.div key={res.state} className={'verdict ' + res.state} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <b>{res.state === 'clean' ? 'No known flags' : res.state === 'flagged' ? 'Flagged · do not pay' : res.state === 'unsupported' ? (k ? `${k.toUpperCase()} address · not covered` : 'Not a recognised address') : 'Couldn’t reach GoPlus'}</b>
        <span className="mono xs dim">{res.state === 'flagged' ? res.flags.join(' · ') : res.source} · {short(addr.trim())}</span></motion.div>}</AnimatePresence></section>
    <section><Label>RECENT BLOCKED ATTEMPTS · THIS DEVICE</Label>
      {log.length ? log.slice(0, 8).map((b, i) => <div className="row" key={i}><span className="grow">{b.what}<br /><span className="mono xs dim">{b.why}</span></span><span className="mono xs dim">{new Date(b.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>)
        : <div className="mono xs dim">Nothing blocked yet. Try paying @drainer-x, or paying more than your cap.</div>}</section>
  </div>
}

const FAQ: [string, string][] = [
  ['Is my money at risk in this preview?', 'No. The preview holds no keys and signs nothing. Payments and swaps are simulated. Quotes are dry runs, so no deposit address is ever created.'],
  ['Where do balances come from?', 'In Example mode they’re made-up numbers. In Live mode ORI reads the public addresses you add in Settings through public RPCs. It’s read-only.'],
  ['What does the scam check do?', 'Before a payment, the recipient goes through GoPlus address security, live. Flagged addresses are blocked and logged in Security.'],
  ['How do the spending limits work?', 'A per-payment cap and a daily cap are checked inside the ORI app, on the payment and swap cards and again right before ORI asks your wallet to sign. They are not on-chain and do not cover transactions you sign outside ORI. Above your hold threshold you must slide all the way across to confirm (or press Enter twice). Ori warns you before you hit a cap.'],
  ['Can Ori move money on his own?', 'No. Ori prepares a card, and you confirm it. Every action needs your tap or hold.'],
  ['Does Ori use an AI model?', 'Not in this preview. Ori runs a local rule-based assistant that answers from your app state, live prices and quotes. No API keys are used, and nothing you type leaves the browser except price and quote lookups.'],
]
export function HelpScreen({ ask }: { ask: (q?: string) => void }) {
  const [open, setOpen] = useState<number | null>(0)
  const how: [string, string][] = [
    ['One balance', 'Your money on Base, Ethereum, Solana and NEAR shows as one total. Stablecoins are spent first.'],
    ['NEAR Intents routing', 'You say what should arrive and where. Solvers compete to deliver it, and ORI shows the fee, the ETA and the minimum out first.'],
    ['Privacy by default', 'Separate addresses per chain with no public link, fresh deposit addresses, and a balance you can hide.'],
    ['Yield, safely', 'Only idle stablecoins, only blue-chip protocols, capped per protocol, and an auto-exit on a depeg.'],
  ]
  const live: [string, boolean][] = [['Prices (1Click tokens)', true], ['Dry-run route quotes (1Click)', true], ['GoPlus scam checks', true], ['Watch-only balances (public RPCs)', true], ['Payments and swaps', false], ['Yield and Earn numbers', false], ['Handle → address lookup', false], ['Ori’s answers (local rules, no LLM)', true]]
  return <div className="pg">
    <section className="pad-top"><Label>HELP</Label><h2 className="big2">How ORI works.</h2>
      <div className="how">{how.map(([h, d]) => <div key={h} className="howc"><b>{h}</b><p className="dim">{d}</p></div>)}</div>
      <button className="cta" onClick={() => ask()}>Ask Ori a question</button></section>
    <section><Label>WHAT’S LIVE IN THIS PREVIEW</Label>
      {live.map(([l, on]) => <div className="row" key={l}><span className="grow">{l}</span><span className={'mono xs ' + (on ? 'live-tag' : 'dim')}>{on ? 'LIVE' : 'SIMULATED'}</span></div>)}</section>
    <section><Label>FAQ</Label>
      {FAQ.map(([q, a], i) => <div className="faq" key={q}><button className="faqq" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}><span className="grow">{q}</span><motion.span animate={{ rotate: open === i ? 45 : 0 }} transition={spring} className="plus">+</motion.span></button>
        <AnimatePresence initial={false}>{open === i && <motion.div className="faqa" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring}><p className="dim">{a}</p></motion.div>}</AnimatePresence></div>)}
      <div className="chips helpchips">{['What’s my balance?', 'Price of SOL', 'Is ORI safe?', 'How does NEAR Intents work?'].map(c => <button key={c} className="mono xs" onClick={() => ask(c)}>{c}</button>)}</div></section>
  </div>
}
