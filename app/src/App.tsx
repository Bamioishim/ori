import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { motion, AnimatePresence } from 'motion/react'
import { APP_NAME } from './config'
import { chains, assets, total, protocols } from './mock'
import Dust from './Dust'
import Ori, { type OriApi } from './Ori'
import { handleHeard, parse, speak, speechSupported, startListening } from './voice'

type Screen = 'home' | 'pay' | 'swap' | 'earn' | 'privacy'
const spring = { type: 'spring' as const, stiffness: 420, damping: 32 }
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function Example() { return <span className="example">EXAMPLE DATA</span> }
function Label({ children }: { children: React.ReactNode }) { return <div className="label">{children}</div> }
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'tg' + (on ? ' on' : '')} onClick={() => onChange(!on)} aria-pressed={on}>
    <motion.span layout transition={spring} /></button>
}

const glyphs: Record<string, React.ReactNode> = {
  USDC: <><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.6c-.4-.9-1.4-1.4-2.6-1.4-1.5 0-2.6.8-2.6 1.9 0 2.6 5.3 1.4 5.3 4 0 1.1-1.1 1.9-2.7 1.9-1.3 0-2.3-.6-2.7-1.5M12 6.6v1.6M12 15.9v1.5" /></>,
  USDT: <><circle cx="12" cy="12" r="8.5" /><path d="M8 8.2h8M12 8.2v8.6M8.6 11.4c2.2.6 4.6.6 6.8 0" /></>,
  SOL: <><path d="M8 6.5h11l-3 3H5zM5 10.5h11l3 3H8zM8 14.5h11l-3 3H5z" /></>,
  ETH: <><path d="M12 3.5 6.8 12 12 15l5.2-3z" /><path d="M6.8 13.2 12 20.5l5.2-7.3L12 16.2z" /></>,
  NEAR: <><path d="M7 17V7l10 10V7" /></>,
}
function Glyph({ s }: { s: string }) { return <span className="glyph"><svg viewBox="0 0 24 24">{glyphs[s]}</svg></span> }
const series: Record<string, number[]> = (() => { const mk = (n: number, seed: number, drift: number) => { let v = 100, x = seed; return Array.from({ length: n }, (_, i) => { x = (x * 9301 + 49297) % 233280; v = v * .8 + (100 + (x / 233280 - 0.5) * 6) * .2; return v + i * drift * 4 }) }; return { '1D': mk(48, 3, .03), '1W': mk(56, 7, .02), '1M': mk(60, 11, .04), '1Y': mk(72, 5, .06) } })()
function Spark({ range }: { range: string }) {
  const d = series[range], W = 340, H = 92, mn = Math.min(...d), mx = Math.max(...d)
  const pts = d.map((v, i) => [i / (d.length - 1) * W, H - 8 - (v - mn) / (mx - mn) * (H - 20)])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const last = pts[pts.length - 1]
  return <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
    <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F5F4F1" stopOpacity=".10" /><stop offset="1" stopColor="#F5F4F1" stopOpacity="0" /></linearGradient></defs>
    <path d={line + ` L${W} ${H} L0 ${H}Z`} fill="url(#sg)" />
    <motion.path key={range} d={line} fill="none" stroke="#F5F4F1" strokeWidth="1" vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
    <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="rgba(217,217,217,.14)" />
    <circle cx={last[0] - 2} cy={last[1]} r="2.5" fill="#F5F4F1" />
  </svg>
}
function useCount(target: number) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => { let r = 0; const t0 = performance.now(), a = from.current; const f = (t: number) => { const k = Math.min((t - t0) / 1400, 1); const nv = a + (target - a) * (1 - Math.pow(1 - k, 4)); from.current = nv; setV(nv); if (k < 1) r = requestAnimationFrame(f) }; r = requestAnimationFrame(f); return () => cancelAnimationFrame(r) }, [target])
  return v
}
function Money({ v, cls = '' }: { v: number; cls?: string }) {
  const [w, c] = v.toFixed(2).split('.')
  return <span className={'money ' + cls}><span className="cur">$</span>{(+w).toLocaleString('en-US')}<span className="cents">.{c}</span></span>
}
function Home({ hidden, setHidden, extra }: { hidden: boolean; setHidden: (v: boolean) => void; extra: number }) {
  const [range, setRange] = useState('1W')
  const [sel, setSel] = useState<string | null>(null)
  const v = useCount(total + extra)
  const hide = hidden
  return <>
    <section className="hero">
      <Dust height={250} />
      <div className="hero-copy">
        <Label>TOTAL BALANCE <Example /></Label>
        <button className={'total' + (hide ? ' blurred' : '')} onClick={() => setHidden(!hidden)} aria-label="Tap to hide balance"><Money v={v} /></button>
        <div className="delta"><span>+$38.62</span><span className="dim">+1.37% · 24h</span><span className="dim">·</span><span className="dim">tap to hide</span></div>
      </div>
    </section>
    <section className="chart">
      <Spark range={range} />
      <div className="ranges">{['1D', '1W', '1M', '1Y'].map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}{range === r && <motion.i layoutId="rg" transition={spring} />}</button>)}</div>
    </section>
    <section>
      <div className="sechead"><Label>ALLOCATION</Label><span className="label">4 CHAINS</span></div>
      <div className="alloc">{chains.map(c => <i key={c.name} style={{ flex: c.usd }} className={sel === c.name ? 'sel' : ''} />)}</div>
      {chains.map(c => <button className={'arow' + (sel === c.name ? ' sel' : '')} key={c.name} onMouseEnter={() => setSel(c.name)} onMouseLeave={() => setSel(null)} onClick={() => setSel(sel === c.name ? null : c.name)}>
        <span className="dot" /><span className="grow">{c.name}</span>
        <span className="pct">{(c.usd / total * 100).toFixed(1)}%</span>
        <span className={'num w' + (hide ? ' blurred' : '')}><Money v={c.usd} cls="sm" /></span></button>)}
    </section>
    <section>
      <div className="sechead"><Label>ASSETS</Label><span className="label">SPEND ORDER</span></div>
      {assets.map((a, i) => <div className="asset" key={i}>
        <Glyph s={a.sym} />
        <span className="grow"><span className="aname">{a.sym}</span><span className="sub">{a.chain} · {a.role}</span></span>
        <span className={'r' + (hide ? ' blurred' : '')}><Money v={a.usd} cls="sm" /><span className="sub">{a.amt.toLocaleString('en-US', { maximumFractionDigits: 4 })} {a.sym}<span className={a.d24 < 0 ? 'neg' : ''}> · {a.d24 > 0 ? '+' : ''}{a.d24.toFixed(1)}%</span></span></span>
      </div>)}
    </section>
  </>
}

export type Draft = { to: string; amt: string; k: number }
const FLAGGED = /drain|0xdead|scam|claim-airdrop/i
function Pay({ draft, status, onConfirm, onRisk }: { draft: Draft; status: 'idle' | 'running' | 'sent'; onConfirm: (r: DOMRect) => void; onRisk: (r: DOMRect | null) => void }) {
  const [to, setTo] = useState(draft.to)
  const [amt, setAmt] = useState(draft.amt)
  const [checked, setChecked] = useState(false)
  const [hold, setHold] = useState(false)
  const cta = useRef<HTMLButtonElement>(null)
  const timer = useRef(0)
  useEffect(() => { setTo(draft.to); setAmt(draft.amt) }, [draft.k])
  const flagged = FLAGGED.test(to)
  useEffect(() => { setChecked(false); const t = setTimeout(() => setChecked(true), 700); return () => clearTimeout(t) }, [to])
  useEffect(() => { onRisk(checked && flagged && cta.current ? cta.current.getBoundingClientRect() : null) }, [checked, flagged])
  useEffect(() => () => onRisk(null), [])
  const st = (ok: string) => !checked ? 'CHECKING…' : flagged ? 'BLOCKED' : ok
  const start = () => { if (!checked || flagged || status !== 'idle') return; setHold(true); timer.current = window.setTimeout(() => { setHold(false); onConfirm(cta.current!.getBoundingClientRect()) }, 750) }
  const cancel = () => { clearTimeout(timer.current); setHold(false) }
  const n = +amt || 0
  return <>
    <section className="pad-top">
      <Label>PAY · TO @HANDLE, PHONE OR EMAIL <Example /></Label>
      <input className="field" value={to} onChange={e => setTo(e.target.value)} disabled={status !== 'idle'} />
      <div className="amount"><span>$</span><input value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" disabled={status !== 'idle'} /></div>
      <div className="mono dim xs">They receive USDC on Solana · their choice of chain</div>
    </section>
    <section>
      <Label>BEST ROUTE · NEAR INTENTS</Label>
      <div className="route">
        <div className="step"><span className="mono xs dim">FROM</span><span>USDC · Base</span><span className="num">{usd(n)}</span></div>
        <div className="line" />
        <div className="step"><span className="mono xs dim">VIA</span><span>Solver quote · 1Click</span><span className="num">~8s</span></div>
        <div className="line" />
        <div className="step"><span className="mono xs dim">TO</span><span>USDC · Solana</span><span className="num">{usd(Math.max(n - 0.04, 0))}</span></div>
      </div>
      <div className="mono xs dim why">Why: stablecoins spent first. SOL kept (+6.8% 24h). Fee $0.04. No bridge, no gas token.</div>
    </section>
    <section>
      <Label>SCAM CHECK</Label>
      <div className="row"><span className="grow">Recipient address</span><span className={'mono xs' + (flagged && checked ? ' bad' : '')}>{st('CLEAN')}</span></div>
      <div className="row"><span className="grow">Token contract</span><span className="mono xs">{checked ? 'VERIFIED' : 'CHECKING…'}</span></div>
      <div className="row"><span className="grow">Drainer / approval risk</span><span className={'mono xs' + (flagged && checked ? ' bad' : '')}>{st('NONE')}</span></div>
    </section>
    {status === 'sent'
      ? <motion.div className="receipt" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <Label>RECEIPT <Example /></Label>
        <div className="money-r">{usd(n)} <span className="dim">sent to {to}</span></div>
        <div className="row"><span className="grow">Route</span><span className="num">Base USDC → Solana USDC</span></div>
        <div className="row"><span className="grow">Settled via</span><span className="num">NEAR Intents · 7.9s</span></div>
        <div className="row"><span className="grow">Fee</span><span className="num">$0.04</span></div>
        <div className="row"><span className="grow">Delivered by</span><span className="num">Ori</span></div>
      </motion.div>
      : <button ref={cta} className={'cta hold' + (hold ? ' holding' : '')} disabled={!checked || flagged || status !== 'idle'}
        onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel}>
        <span className="fill" />{flagged && checked ? 'Blocked — flagged address' : status === 'running' ? 'Ori is delivering…' : `Hold to pay ${usd(n)}`}</button>}
  </>
}

function Swap() {
  const [flip, setFlip] = useState(false)
  const a = { s: 'SOL', c: 'Solana', v: '1.00', u: '$181.10' }, b = { s: 'USDC', c: 'any chain', v: '180.92', u: '$180.92' }
  const [x, y] = flip ? [b, a] : [a, b]
  return <>
    <section className="pad-top">
      <Label>SWAP · ONE TAP <Example /></Label>
      {[x, y].map((t, i) => <div className="swapbox" key={i}>
        <span className="mono xs dim">{i ? 'RECEIVE' : 'SEND'}</span>
        <div className="swaprow"><span className="big2">{t.v}</span><span>{t.s}<br /><span className="mono xs dim">{t.c}</span></span></div>
        <span className="mono xs dim">{t.u}</span>
        {i === 0 && <motion.button className="flip" whileTap={{ rotate: 180 }} transition={spring} onClick={() => setFlip(!flip)}>⇅</motion.button>}
      </div>)}
    </section>
    <section>
      <Label>QUOTE</Label>
      <div className="row"><span className="grow">Rate</span><span className="num">1 SOL = 180.92 USDC</span></div>
      <div className="row"><span className="grow">Settlement</span><span className="num">NEAR Intents · ~10s</span></div>
      <div className="row"><span className="grow">Network fee</span><span className="num">Paid from balance</span></div>
      <div className="row"><span className="grow">Token risk</span><span className="num">Low</span></div>
    </section>
    <motion.button whileTap={{ scale: 0.97 }} transition={spring} className="cta">Swap</motion.button>
  </>
}

function Earn() {
  const [on, setOn] = useState(true)
  const [floor, setFloor] = useState(100)
  const [exit, setExit] = useState(true)
  return <>
    <section className="pad-top">
      <Label>EARN · YIELD GUARD <Example /></Label>
      <h2 className="big2">Idle stablecoins earn.<br /><span className="dim">Nothing else moves.</span></h2>
      <div className="row"><span className="grow">Auto-yield (opt-in)</span><Toggle on={on} onChange={setOn} /></div>
      <div className="row col"><span className="grow">Keep liquid above <b className="num">${floor}</b></span>
        <input type="range" min={0} max={1000} step={50} value={floor} onChange={e => setFloor(+e.target.value)} /></div>
      <div className="row"><span className="grow">Auto-exit on depeg &gt;0.5% or TVL −20% / 24h</span><Toggle on={exit} onChange={setExit} /></div>
      <div className="row"><span className="grow">Withdraw</span><span className="mono xs">INSTANT · SPEND PULLS FROM YIELD</span></div>
    </section>
    <section>
      <Label>WHITELIST · BLUE-CHIP ONLY</Label>
      {protocols.map(p => <div className="row" key={p.name + p.chain}>
        <span className="grow">{p.name} <span className="mono dim xs">/{p.chain.toUpperCase()}</span><br /><span className="mono dim xs">TVL {p.tvl} · cap {p.cap}%</span></span>
        <span className="num r">{p.apy.toFixed(1)}%<br /><span className="mono xs dim">{p.alloc ? usd(p.alloc) : '—'}</span></span></div>)}
    </section>
  </>
}

function Privacy({ hidden, setHidden }: { hidden: boolean; setHidden: (v: boolean) => void }) {
  const [s, setS] = useState({ unlink: true, tee: true, stealth: true, analytics: false })
  const items: [keyof typeof s, string, string][] = [
    ['unlink', 'Unlinkable addresses', 'Each chain address is derived separately via Chain Signatures; no public link between them.'],
    ['stealth', 'Fresh deposit address per payment', 'Incoming payments never reuse an address.'],
    ['tee', 'Private AI (TEE)', 'Route + scam reasoning runs in NEAR AI Cloud confidential compute. Attestation verifiable.'],
    ['analytics', 'Share anonymous usage', 'Off by default.'],
  ]
  return <>
    <section className="pad-top">
      <Label>PRIVACY · DEFAULT ON</Label>
      <h2 className="big2">Your total is yours.<br /><span className="dim">Not the explorer’s.</span></h2>
      <div className="row"><span className="grow">Hide balance on screen</span><Toggle on={hidden} onChange={setHidden} /></div>
      {items.map(([k, t, d]) => <div className="row" key={k}><span className="grow">{t}<br /><span className="mono xs dim">{d}</span></span>
        <Toggle on={s[k]} onChange={v => setS({ ...s, [k]: v })} /></div>)}
    </section>
    <section>
      <Label>WHAT THE PUBLIC SEES <Example /></Label>
      <div className="mono xs leak">0x7a3…e91 · Base · 1,120 USDC<br />9xQe…4kP · Solana · 4.1 SOL<br />——<br />Linked owner: <b>none</b> · Total: <b>unknown</b></div>
    </section>
  </>
}

export default function App() {
  const initial = (new URLSearchParams(location.search).get('screen') as Screen) || 'home'
  const [screen, setScreen] = useState<Screen>(initial)
  const [hidden, setHidden] = useState(false)
  const [extra, setExtra] = useState(0)
  const [draft, setDraft] = useState<Draft>({ to: '@tolu', amt: '50', k: 0 })
  const [status, setStatus] = useState<'idle' | 'running' | 'sent'>('idle')
  const [chat, setChat] = useState(false)
  const [msgs, setMsgs] = useState<{ who: 'me' | 'ori'; t: string }[]>([{ who: 'ori', t: 'Hi, I’m Ori. Ask me to pay, swap or hide your balance. I always show you a card to confirm first.' }])
  const [input, setInput] = useState('')
  const [mic, setMic] = useState<'off' | 'listening' | 'unsupported' | 'denied'>('off')
  const [heard, setHeard] = useState<string | null>(null)
  const ori = useRef<OriApi>(null)
  const stopMic = useRef<() => void>(() => { })
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => { if (reduced) return; const l = new Lenis({ lerp: 0.12 }); let r = 0; const f = (t: number) => { l.raf(t); r = requestAnimationFrame(f) }; r = requestAnimationFrame(f); return () => { cancelAnimationFrame(r); l.destroy() } }, [])
  useEffect(() => { document.title = APP_NAME }, [])
  // example incoming payment → balance up → Ori hops
  useEffect(() => { const t = setTimeout(() => { setExtra(12); ori.current?.hop(); ori.current?.say('+$12.00 from @ade. Nice. (example)', 2800) }, 5200); return () => clearTimeout(t) }, [])
  // sheet open → Ori returns to rest on the sheet's edge
  useEffect(() => { ori.current?.rest(chat ? innerHeight - 360 : null) }, [chat])

  const oriSay = (t: string, voice = false) => { setMsgs(m => [...m, { who: 'ori', t }]); ori.current?.say(t); if (voice) speak(t) }
  const command = (text: string, src = 'chat') => {
    setMsgs(m => [...m, { who: 'me', t: text }])
    const a = parse(text); const v = src !== 'chat'
    if (a.kind === 'pay') {
      setStatus('idle'); setDraft({ to: a.to, amt: a.amt, k: Date.now() }); setScreen('pay'); setChat(false); scrollTo(0, 0)
      setTimeout(() => oriSay(`Card’s ready: $${a.amt} to ${a.to}. Check it, then hold to pay.`, v), 450)
    } else if (a.kind === 'swap') { setScreen('swap'); setChat(false); oriSay('Swap is open. Pick what to send.', v) }
    else if (a.kind === 'hide') { setHidden(true); oriSay('Hidden.', v) }
    else if (a.kind === 'show') { setHidden(false); oriSay('Back on.', v) }
    else if (a.kind === 'balance') oriSay(hidden ? 'It’s hidden. Say “show balance”.' : `You have ${usd(total + extra)} across 4 chains (example).`, v)
    else oriSay('I can pay, swap, or hide your balance. Try “send $20 to tolu”.', v)
  }
  const wake = (src: string) => { ori.current?.listen(); setHeard(src === 'simulated' ? '“Hey Ori” · simulated' : '“Hey Ori”'); oriSay('Hey! What do you need?', true) }
  // single entry for speech results (real mic and the demo simulation both call this)
  const heardCb = { onWake: wake, onCommand: (t: string, src: string) => { setHeard(`“${t}”${src === 'simulated' ? ' · simulated' : ''}`); command(t, src) }, onState: (s: string) => setMic(s as any) }
  useEffect(() => { (window as any).__ori = { hear: (t: string) => handleHeard(t, heardCb, 'simulated') } })
  const toggleMic = () => { if (mic === 'listening') { stopMic.current(); return } if (!speechSupported()) { setMic('unsupported'); oriSay('Voice isn’t supported in this browser. Tap me to talk instead.'); return } stopMic.current = startListening(heardCb) }
  const confirm = async (r: DOMRect) => { setStatus('running'); await ori.current?.run(r); setStatus('sent'); setExtra(e => e - (+draft.amt || 0)); oriSay('Delivered. Receipt’s on the card.') }

  const tabs: Screen[] = ['home', 'pay', 'swap', 'earn', 'privacy']
  return <div className="app">
    <div className="grain" />
    <header><span className="logo">{APP_NAME}<sup>®</sup></span>
      <button className={'mic ' + mic} onClick={toggleMic} aria-pressed={mic === 'listening'} title="Listen for “Hey Ori”">
        <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
        <span className="mono xs">{mic === 'listening' ? 'HEY ORI · ON' : mic === 'unsupported' ? 'TAP ORI' : mic === 'denied' ? 'MIC BLOCKED' : 'HEY ORI'}</span></button></header>
    <AnimatePresence>{heard && <motion.div className="heard mono xs" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onAnimationComplete={() => setTimeout(() => setHeard(null), 3500)}>HEARD {heard}</motion.div>}</AnimatePresence>
    <AnimatePresence mode="wait">
      <motion.main key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
        {screen === 'home' && <Home hidden={hidden} setHidden={setHidden} extra={extra} />}
        {screen === 'pay' && <Pay draft={draft} status={status} onConfirm={confirm} onRisk={r => ori.current?.block(r)} />}
        {screen === 'swap' && <Swap />}
        {screen === 'earn' && <Earn />}
        {screen === 'privacy' && <Privacy hidden={hidden} setHidden={setHidden} />}
      </motion.main>
    </AnimatePresence>
    <nav>{tabs.map((t, i) => <button key={t} onClick={() => { setScreen(t); if (t === 'pay' && status === 'sent') setStatus('idle'); scrollTo(0, 0) }} className={screen === t ? 'on' : ''}>
      <span className="mono xs">{String(i + 1).padStart(2, '0')}</span>{t}
      {screen === t && <motion.i layoutId="nav" transition={spring} />}</button>)}</nav>
    <AnimatePresence>{chat && <>
      <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChat(false)} />
      <motion.div className="sheet" initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={spring}>
        <div className="sheet-head"><Label>ORI · YOUR AGENT · MOCK AI</Label><button className="mono xs dim" onClick={() => setChat(false)}>CLOSE</button></div>
        <div className="msgs">{msgs.slice(-4).map((m, i) => <div key={i} className={'msg ' + (m.who === 'me' ? 'me' : 'bot')}>{m.t}</div>)}</div>
        <div className="chips">{['send $20 to tolu', 'hide my balance', 'swap'].map(c => <button key={c} className="mono xs" onClick={() => command(c)}>{c}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); if (input.trim()) { command(input); setInput('') } }} className="ask">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Ori…" /><button className="mono xs">SEND</button></form>
      </motion.div></>}</AnimatePresence>
    <Ori ref={ori} hidden={hidden} reduced={reduced} screen={screen} onTap={() => setChat(true)} />
  </div>
}
