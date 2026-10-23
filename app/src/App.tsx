import { useEffect, useState } from 'react'
import Lenis from 'lenis'
import { motion, AnimatePresence } from 'motion/react'
import { APP_NAME, APP_TAGLINE } from './config'
import { chains, assets, total, protocols } from './mock'
import Dust from './Dust'

type Screen = 'home' | 'pay' | 'swap' | 'earn' | 'privacy'
const spring = { type: 'spring' as const, stiffness: 420, damping: 32 }
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

function Example() { return <span className="example">EXAMPLE DATA</span> }
function Label({ children }: { children: React.ReactNode }) { return <div className="label">{children}</div> }
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button className={'tg' + (on ? ' on' : '')} onClick={() => onChange(!on)} aria-pressed={on}>
    <motion.span layout transition={spring} /></button>
}

function Home({ hidden }: { hidden: boolean }) {
  const [whole, cents] = usd(total).split('.')
  return <>
    <section className="hero">
      <Dust height={300} />
      <div className="hero-copy">
        <Label>TOTAL BALANCE · 4 CHAINS <Example /></Label>
        <h1 className="big">{hidden ? '$••••' : whole}<small>{hidden ? '' : '.' + cents}</small></h1>
        <div className="mono dim">+$4.20 earned this week · private</div>
      </div>
    </section>
    <section>
      <Label>01 — BY CHAIN</Label>
      <div className="bar">{chains.map(c => <i key={c.name} style={{ flex: c.usd }} />)}</div>
      {chains.map((c, i) => <div className="row" key={c.name}>
        <span className="mono dim">{String(i + 1).padStart(2, '0')}</span>
        <span className="grow">{c.name}<br /><span className="mono dim xs">{c.addr}</span></span>
        <span className="num">{hidden ? '••••' : usd(c.usd)}</span></div>)}
    </section>
    <section>
      <Label>02 — ASSETS · SPEND ORDER</Label>
      {assets.map((a, i) => <div className="row" key={i}>
        <span className="grow">{a.sym} <span className="mono dim xs">/{a.chain.toUpperCase()}</span><br /><span className="mono dim xs">{a.role}</span></span>
        <span className="num r">{hidden ? '••••' : usd(a.usd)}<br /><span className={'mono xs ' + (a.d24 >= 0 ? '' : 'dim')}>{a.d24 > 0 ? '+' : ''}{a.d24.toFixed(1)}%</span></span>
      </div>)}
    </section>
  </>
}

function Pay() {
  const [to, setTo] = useState('@tolu')
  const [amt, setAmt] = useState('50')
  const [checked, setChecked] = useState(false)
  useEffect(() => { setChecked(false); const t = setTimeout(() => setChecked(true), 700); return () => clearTimeout(t) }, [to])
  return <>
    <section className="pad-top">
      <Label>PAY · TO @HANDLE, PHONE OR EMAIL <Example /></Label>
      <input className="field" value={to} onChange={e => setTo(e.target.value)} />
      <div className="amount"><span>$</span><input value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" /></div>
      <div className="mono dim xs">They receive USDC on Solana · their choice of chain</div>
    </section>
    <section>
      <Label>BEST ROUTE · NEAR INTENTS</Label>
      <div className="route">
        <div className="step"><span className="mono xs dim">FROM</span><span>USDC · Base</span><span className="num">$50.00</span></div>
        <div className="line" />
        <div className="step"><span className="mono xs dim">VIA</span><span>Solver quote · 1Click</span><span className="num">~8s</span></div>
        <div className="line" />
        <div className="step"><span className="mono xs dim">TO</span><span>USDC · Solana</span><span className="num">$49.96</span></div>
      </div>
      <div className="mono xs dim why">Why: stablecoins spent first. SOL kept (+6.8% 24h). Fee $0.04. No bridge, no gas token.</div>
    </section>
    <section>
      <Label>SCAM CHECK</Label>
      <div className="row"><span className="grow">Recipient address</span><span className="mono xs">{checked ? 'CLEAN' : 'CHECKING…'}</span></div>
      <div className="row"><span className="grow">Token contract</span><span className="mono xs">{checked ? 'VERIFIED' : 'CHECKING…'}</span></div>
      <div className="row"><span className="grow">Drainer / approval risk</span><span className="mono xs">{checked ? 'NONE' : 'CHECKING…'}</span></div>
    </section>
    <motion.button whileTap={{ scale: 0.97 }} transition={spring} className="cta" disabled={!checked}>Hold to pay {usd(+amt || 0)}</motion.button>
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
  useEffect(() => { const l = new Lenis({ lerp: 0.12 }); let r = 0; const f = (t: number) => { l.raf(t); r = requestAnimationFrame(f) }; r = requestAnimationFrame(f); return () => { cancelAnimationFrame(r); l.destroy() } }, [])
  useEffect(() => { document.title = APP_NAME }, [])
  const tabs: Screen[] = ['home', 'pay', 'swap', 'earn', 'privacy']
  return <div className="app">
    <div className="grain" />
    <header><span className="logo">{APP_NAME}<sup>®</sup></span><span className="mono xs dim">{APP_TAGLINE}</span></header>
    <AnimatePresence mode="wait">
      <motion.main key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
        {screen === 'home' && <Home hidden={hidden} />}
        {screen === 'pay' && <Pay />}
        {screen === 'swap' && <Swap />}
        {screen === 'earn' && <Earn />}
        {screen === 'privacy' && <Privacy hidden={hidden} setHidden={setHidden} />}
      </motion.main>
    </AnimatePresence>
    <nav>{tabs.map((t, i) => <button key={t} onClick={() => { setScreen(t); scrollTo(0, 0) }} className={screen === t ? 'on' : ''}>
      <span className="mono xs">{String(i + 1).padStart(2, '0')}</span>{t}
      {screen === t && <motion.i layoutId="nav" transition={spring} />}</button>)}</nav>
  </div>
}
