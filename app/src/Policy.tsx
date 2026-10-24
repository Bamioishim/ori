import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useDragControls } from 'motion/react'
import { goplus, short, type Risk } from './live'
import { APPROVALS, SUSPICIOUS, logEvent, revoke, revoked, spentToday, usd, useFeed, type FeedKind, type Settings } from './settings'
import { assets } from './mock'
import { Dots } from './Loaders'
const spring = { type: 'spring' as const, stiffness: 420, damping: 32 }
function Label({ children }: { children: React.ReactNode }) { return <div className="label">{children}</div> }
function Num({ v, onChange, step = 10 }: { v: number; onChange: (n: number) => void; step?: number }) {
  return <span className="numin"><button onClick={() => onChange(Math.max(0, v - step))} aria-label="Decrease">−</button><span className="mono">$<input value={v} inputMode="decimal" onChange={e => onChange(+e.target.value.replace(/[^\d.]/g, '') || 0)} /></span><button onClick={() => onChange(v + step)} aria-label="Increase">+</button></span>
}
type P = { s: Settings; set: (p: Partial<Settings>) => void }
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) }
const ICON: Record<FeedKind, string> = { flag: '!', block: '×', approve: '✓', revoke: '↺', info: '·' }

export function PolicyScreen({ s, set }: P) {
  const [who, setWho] = useState('')
  const spent = spentToday()
  const add = () => { const w = who.trim(); if (w && !s.trusted.includes(w)) { set({ trusted: [...s.trusted, w] }); logEvent('info', 'Ori added a contact to your allowlist', w); setWho('') } }
  return <div className="pg">
    <section className="pad-top"><Label>POLICY & LIMITS · ENFORCED BY ORI</Label><h2 className="big2">Ori can only spend<br /><span className="dim">inside these lines.</span></h2>
      <div className="mono xs dim">Saved on this device. Every send and swap is checked against this policy before the confirmation sheet lets it through.</div></section>
    <section><Label>SPENDING CAPS</Label>
      <div className="row"><span className="grow">Daily cap<br /><span className="mono xs dim">{usd(spent)} used today · {usd(Math.max(0, s.daily - spent))} left</span></span><Num v={s.daily} onChange={v => set({ daily: v })} step={50} /></div>
      <div className="meter"><motion.i initial={{ width: 0 }} animate={{ width: Math.min(100, spent / (s.daily || 1) * 100) + '%' }} transition={spring} /></div>
      <div className="row"><span className="grow">Per-transaction cap<br /><span className="mono xs dim">Anything above is blocked outright</span></span><Num v={s.perPay} onChange={v => set({ perPay: v })} step={25} /></div></section>
    <section><Label>APPROVAL THRESHOLD</Label>
      <div className="row"><span className="grow">Extra confirmation above<br /><span className="mono xs dim">Above this, you press and hold on the confirmation sheet. Below it, one tap.</span></span><Num v={s.holdAbove} onChange={v => set({ holdAbove: v })} step={5} /></div>
      <div className="policy-sum mono xs">
        <span>≤ {usd(s.holdAbove)} · TAP</span><span>≤ {usd(s.perPay)} · HOLD</span><span className="bad">&gt; {usd(s.perPay)} · BLOCKED</span></div></section>
    <section className="pg-wide"><Label>RECIPIENT ALLOWLIST · {s.trusted.length}</Label>
      <AnimatePresence initial={false}>{s.trusted.map(t => <motion.div layout className="row" key={t} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={spring}>
        <span className="grow">{t.length > 24 ? short(t) : t}</span><span className="mono xs ok-tag">ALLOWLISTED</span>
        <button className="mono xs dim" onClick={() => { set({ trusted: s.trusted.filter(x => x !== t) }); logEvent('info', 'Ori removed a contact from your allowlist', t) }}>REMOVE</button></motion.div>)}</AnimatePresence>
      <form className="addaddr" onSubmit={e => { e.preventDefault(); add() }}>
        <input value={who} onChange={e => setWho(e.target.value)} placeholder="@handle or address" spellCheck={false} /><button className="mono xs" disabled={!who.trim()}>ADD</button></form>
      <div className="mono xs dim">Sends to anyone not on this list are flagged on the confirmation sheet, and you must tick “I know this recipient”.</div></section>
  </div>
}

export type SheetData = { kind: 'pay' | 'swap'; to: string; amount: string; usdv: number; chain: string; fee: number | null; blocked: string | null }
export function ConfirmSheet({ d, cfg, onCancel, onConfirm }: { d: SheetData; cfg: Settings; onCancel: () => void; onConfirm: () => void }) {
  const allow = d.kind === 'swap' || cfg.trusted.includes(d.to.trim())
  const need = d.usdv > cfg.holdAbove
  const [ack, setAck] = useState(false); const opened = useRef(performance.now()); const dc = useDragControls()
  const [hold, setHold] = useState(false); const t = useRef(0)
  const warns: [string, string][] = []
  if (d.blocked) warns.push(['bad', 'Blocked · ' + d.blocked])
  if (!allow) warns.push(['warn', `${d.to} isn’t on your allowlist.`])
  if (need && !d.blocked) warns.push(['info', `Above your ${usd(cfg.holdAbove)} approval threshold · hold to confirm.`])
  const left = Math.max(0, cfg.daily - spentToday())
  const ready = !d.blocked && (allow || ack)
  const go = () => { if (!ready) return; logEvent('approve', allow && d.kind === 'pay' ? 'Ori approved a send to an allowlisted contact' : d.kind === 'swap' ? 'Ori approved a swap inside your limits' : 'Ori approved a send you confirmed', `${d.amount} → ${d.to}`); onConfirm() }
  const down = () => { if (!ready || !need) return; navigator.vibrate?.(12); setHold(true); t.current = window.setTimeout(() => { setHold(false); navigator.vibrate?.([18, 40, 18]); go() }, 900) }
  const up = () => { clearTimeout(t.current); setHold(false) }
  useEffect(() => () => clearTimeout(t.current), [])
  return <>
    <motion.div className="scrim cscrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={e => { if (e.target === e.currentTarget && performance.now() - opened.current > 450) onCancel() }} />
    <motion.div className="csheet" drag="y" dragControls={dc} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .6 }} onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onCancel() }}
      onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }} transition={spring} role="dialog" aria-label="Confirm">
      <div className="grabzone" onPointerDown={e => dc.start(e)} style={{ touchAction: 'none' }}><div className="grab" /></div>
      <div className="sheet-head"><Label>{d.blocked ? 'ORI STOPPED THIS' : 'CONFIRM ' + (d.kind === 'pay' ? 'SEND' : 'SWAP')} <span className="example">SIMULATED</span></Label><button className="mono xs dim" onClick={onCancel}>CANCEL</button></div>
      <div className="csum">{d.amount}</div>
      <div className="row"><span className="grow dim">Recipient</span><span className="num">{d.to.length > 24 ? short(d.to) : d.to}{allow && d.kind === 'pay' && <span className="mono xs ok-tag" style={{ marginLeft: 8 }}>ALLOWLISTED</span>}</span></div>
      <div className="row"><span className="grow dim">Amount</span><span className="num">{usd(d.usdv)}</span></div>
      <div className="row"><span className="grow dim">Chain</span><span className="num">{d.chain}</span></div>
      <div className="row"><span className="grow dim">Network fee</span><span className="num">{d.fee === null ? '—' : usd(d.fee)}</span></div>
      <div className="row"><span className="grow">Total</span><span className="num">{usd(d.usdv + (d.fee || 0))}</span></div>
      <div className="row"><span className="grow dim">Left today after this</span><span className="num">{usd(Math.max(0, left - d.usdv))}</span></div>
      {warns.map(([k, w], i) => <motion.div key={w} className={'pwarn ' + k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring, delay: .08 + i * .05 }}><b>{k === 'bad' ? '×' : k === 'warn' ? '!' : 'i'}</b>{w}</motion.div>)}
      {!allow && !d.blocked && <label className={'ack' + (ack ? ' on' : '')}><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /><span>I know this recipient</span></label>}
      {d.blocked ? <button className="cta" onClick={onCancel}>Got it · change limits in Policy</button>
        : <button className={'cta hold mint' + (hold ? ' holding' : '') + (need ? ' needhold' : '')} disabled={!ready} onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()} onClick={() => { if (!need) go() }}>
          <span className="fill" />{!ready ? 'Tick “I know this recipient” first' : need ? 'Hold to confirm' : 'Tap to confirm'}</button>}
    </motion.div></>
}

export function Feed({ max = 6 }: { max?: number }) {
  const f = useFeed()
  return <div className="feed">
    <AnimatePresence initial={false}>{f.slice(0, max).map(e => <motion.div layout key={e.at + e.text} className={'fitem ' + e.kind} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <span className="fic">{ICON[e.kind]}</span>
      <span className="grow">{e.text}{e.demo && <span className="example" style={{ marginLeft: 6 }}>DEMO</span>}<br /><span className="mono xs dim">{e.sub}</span></span>
      <span className="mono xs dim" title={new Date(e.at).toLocaleString('en-GB')}>{ago(e.at)}</span></motion.div>)}</AnimatePresence>
  </div>
}

export function ScanScreen() {
  const [rv, setRv] = useState(revoked)
  const [live, setLive] = useState<Record<string, Risk | 'loading'>>({})
  const [busy, setBusy] = useState<string | null>(null)
  useEffect(() => { APPROVALS.forEach(a => { setLive(l => ({ ...l, [a.id]: 'loading' })); goplus(a.spender).then(r => setLive(l => ({ ...l, [a.id]: r }))).catch(() => setLive(l => ({ ...l, [a.id]: { state: 'error', flags: [], source: 'GoPlus' } }))) }) }, [])
  const act = APPROVALS.filter(a => !rv.includes(a.id))
  const risky = act.filter(a => a.risk || (live[a.id] as Risk)?.state === 'flagged').length + SUSPICIOUS.length
  const doRevoke = async (id: string) => { const a = APPROVALS.find(x => x.id === id)!; setBusy(id); await new Promise(r => setTimeout(r, 900)); revoke(id); setRv(revoked()); setBusy(null); logEvent('revoke', 'Ori revoked a token approval (demo)', `${a.token} on ${a.chain} · ${a.name} · ${short(a.spender)}`) }
  return <div className="pg">
    <section className="pad-top"><Label>SCAM & APPROVAL SCANNER <span className="example">EXAMPLE DATA</span></Label><h2 className="big2">{risky ? <>{risky} thing{risky > 1 ? 's' : ''} need<br /><span className="dim">your attention.</span></> : <>All clear.<br /><span className="dim">Nothing risky found.</span></>}</h2>
      <div className="mono xs dim">Example approvals and holdings. Spender addresses are checked live with GoPlus address security (EVM). Revoke is a demo: nothing is signed.</div></section>
    <section><Label>TOKEN APPROVALS · {act.length}</Label>
      <AnimatePresence initial={false}>{act.map(a => { const g = live[a.id]; const flagged = g && g !== 'loading' && g.state === 'flagged'
        return <motion.div layout key={a.id} className={'appr' + (flagged || a.risk ? ' risky' : '')} exit={{ opacity: 0, height: 0, marginBottom: 0 }} transition={spring}>
          <div className="row"><span className="grow"><b>{a.token}</b> <span className="dim">· {a.chain}</span><br /><span className="mono xs dim">{a.name} · {short(a.spender)}</span></span>
            <span className={'mono xs' + (a.amount === 'Unlimited' ? ' bad' : '')}>{a.amount === 'Unlimited' ? 'UNLIMITED' : usd(a.amount)}</span></div>
          <div className="mono xs gp">GOPLUS · {g === 'loading' || !g ? <Dots size={4} label="Checking" /> : g.state === 'flagged' ? <span className="bad">FLAGGED · {g.flags.join(', ')}</span> : g.state === 'clean' ? 'NO FLAGS · LIVE' : g.state === 'error' ? 'UNREACHABLE' : 'NOT COVERED'}</div>
          {a.risk && <div className="pwarn warn"><b>!</b>{a.risk}</div>}
          {(a.risk || flagged) && <button className="ghost danger" disabled={busy === a.id} onClick={() => doRevoke(a.id)}>{busy === a.id ? <Dots size={4} label="Revoking" /> : 'Revoke (demo)'}</button>}
        </motion.div> })}</AnimatePresence>
      {!act.length && <div className="mono xs dim">No active approvals.</div>}
      {rv.length > 0 && <div className="mono xs dim" style={{ marginTop: 12 }}>{rv.length} revoked on this device.</div>}</section>
    <section><Label>HOLDINGS</Label>
      {SUSPICIOUS.map(t => <div className="appr risky" key={t.sym}><div className="row"><span className="grow"><b>{t.sym}</b> <span className="dim">· {t.chain}</span><br /><span className="mono xs dim">{t.amt.toLocaleString()} tokens · value unknown</span></span><span className="mono xs bad">SUSPICIOUS</span></div>
        <div className="pwarn bad"><b>×</b>{t.why}. Don’t interact or try to sell it.</div></div>)}
      {assets.map((a, i) => <div className="row" key={i}><span className="grow">{a.sym} <span className="dim">· {a.chain}</span></span><span className="mono xs dim">CANONICAL · OK</span></div>)}</section>
  </div>
}
