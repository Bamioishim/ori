import { LogoH } from './Logo'
import { Fragment, useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { motion, AnimatePresence } from 'motion/react'
import { APP_NAME } from './config'
import { addSpent, limitCheck, logBlocked, setFmt, spentToday, usd, useSettings, type Settings } from './settings'
import { SettingsScreen, SecurityScreen, HelpScreen } from './Screens'
import { PolicyScreen, ScanScreen, ConfirmSheet, Feed, type SheetData } from './Policy'
import { answer, DEFAULT_CHIPS, type Act, type Reply } from './brain'
import { chains, assets, total, protocols } from './mock'
import Nebula, { nebulaThink, nebulaDone } from './Nebula'
import Intro, { useIntro } from './Intro'
import { Dots, Check } from './Loaders'
import { LayoutGroup } from 'motion/react'
import Ori, { type OriApi } from './Ori'
import { ASSET, PREVIEW, goplus, kindOf, quote, readPortfolio, short, tokens, type Holding, type Quote, type Risk } from './live'
import { handleHeard, speak, speechSupported, startListening } from './voice'

type Screen = 'home' | 'pay' | 'swap' | 'policy' | 'scan' | 'earn' | 'privacy' | 'settings' | 'security' | 'help'
const spring = { type: 'spring' as const, stiffness: 420, damping: 32 }

const CHAIN_COL: Record<string, string> = { Base: '#7F9BB8', Solana: '#9C8AAE', Ethereum: '#8E98A6', NEAR: '#8FA88A' }
const chainCol = (n: string) => CHAIN_COL[n] || '#B39A82'

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
  return <span className={'money ' + cls + (w.length >= 9 ? ' l9' : w.length >= 7 ? ' l7' : '')}><span className="cur">$</span>{(+w).toLocaleString('en-US')}<span className="cents">.{c}</span></span>
}
export type Mode = 'example' | 'live'
export type LiveState = { loading: boolean; holdings: Holding[]; errors: string[]; at: number | null }
const ROLE = (h: { sym: string }) => /USD/.test(h.sym) ? 'Spend first' : 'Held'
function Watch({ addrs, setAddrs, live, refresh }: { addrs: string[]; setAddrs: (a: string[]) => void; live: LiveState; refresh: () => void }) {
  const [v, setV] = useState('')
  const k = kindOf(v)
  return <section className="watch">
    <div className="sechead"><Label>WATCH-ONLY ADDRESSES</Label><button className="label linkish" onClick={refresh} disabled={live.loading}>{live.loading ? <Dots size={4} label="Reading" /> : 'REFRESH'}</button></div>
    {addrs.map(a => <div className="row" key={a}><span className="mono xs tag">{kindOf(a)?.toUpperCase()}</span><span className="grow mono addr">{short(a)}</span><button className="mono xs dim" onClick={() => setAddrs(addrs.filter(x => x !== a))}>REMOVE</button></div>)}
    <form className="addaddr" onSubmit={e => { e.preventDefault(); if (k && !addrs.includes(v.trim())) { setAddrs([...addrs, v.trim()]); setV('') } }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder="Paste 0x…, Solana or .near address" spellCheck={false} />
      <button className="mono xs" disabled={!k}>{v && !k ? 'INVALID' : 'ADD'}</button></form>
    <div className="mono xs dim">Read-only. Public RPCs, no keys, nothing is signed.</div>
    {live.errors.map(e => <div className="mono xs err" key={e}>{e}</div>)}
  </section>
}
function Home({ hidden, setHidden, extra, mode, setMode, live, addrs, setAddrs, refresh, wide = false, go }: { wide?: boolean; go?: (s: Screen, to?: string, amt?: string) => void; hidden: boolean; setHidden: (v: boolean) => void; extra: number; mode: Mode; setMode: (m: Mode) => void; live: LiveState; addrs: string[]; setAddrs: (a: string[]) => void; refresh: () => void }) {
  const [range, setRange] = useState('1W')
  const [sel, setSel] = useState<string | null>(null)
  const isLive = mode === 'live'
  const rows = isLive ? live.holdings.map(h => ({ sym: h.sym, chain: h.chain, amt: h.amt, usd: h.usd, role: ROLE(h) + ' · ' + short(h.addr), d24: null as number | null })) : assets.map(a => ({ ...a, d24: a.d24 as number | null }))
  const chainRows = isLive ? (['Ethereum', 'Base', 'Solana', 'NEAR'] as const).map(n => ({ name: n, usd: live.holdings.filter(h => h.chain === n).reduce((x, h) => x + h.usd, 0) })).filter(c => c.usd > 0).sort((a, b) => b.usd - a.usd) : chains
  const sum = isLive ? chainRows.reduce((x, c) => x + c.usd, 0) : total + extra
  const v = useCount(sum)
  const hide = hidden
  const empty = isLive && !live.loading && !live.holdings.length
  if (wide) return <HomeDesk {...{ hidden, setHidden, mode, setMode, live, addrs, setAddrs, refresh, isLive, rows, chainRows, sum, v, empty, range, setRange, sel, setSel, go: go! }} />
  return <>
    <section className="hero">
      <div className="hero-copy">
        <div className="modes">{(['example', 'live'] as Mode[]).map(m => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'live' ? 'Watch-only · live' : 'Example data'}{mode === m && <motion.i layoutId="md" transition={spring} />}</button>)}</div>
        <Label>TOTAL BALANCE {isLive ? <span className="live-tag">LIVE · READ-ONLY</span> : <Example />}</Label>
        <button className={'total' + (hide ? ' blurred' : '') + (isLive && live.loading && !live.at ? ' loading' : '')} onClick={() => setHidden(!hidden)} aria-label="Tap to hide balance"><Money v={v} /></button>
        <div className="delta">{isLive
          ? <><span className="dim">{live.loading ? <Dots size={5} label="Reading balances" /> : live.at ? `${addrs.length} address${addrs.length === 1 ? '' : 'es'} · prices 1Click · ${new Date(live.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Add an address below'}</span><span className="dim">·</span><span className="dim">tap to hide</span></>
          : <><span>+$38.62</span><span className="dim">+1.37% · 24h</span><span className="dim">·</span><span className="dim">tap to hide</span></>}</div>
      </div>
    </section>
    {isLive && <Watch addrs={addrs} setAddrs={setAddrs} live={live} refresh={refresh} />}
    {!isLive && <section className="chart">
      <Spark range={range} />
      <div className="ranges">{['1D', '1W', '1M', '1Y'].map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}{range === r && <motion.i layoutId="rg" transition={spring} />}</button>)}</div>
    </section>}
    <section>
      <div className="sechead"><Label>ORI ACTIVITY</Label><button className="label linkish" onClick={() => go?.('scan')}>SCANNER →</button></div>
      <Feed max={4} />
    </section>
    {!empty && <section>
      <div className="sechead"><Label>ALLOCATION</Label><span className="label">{chainRows.length} CHAINS</span></div>
      <div className="alloc">{chainRows.map(c => <i key={c.name} style={{ flex: c.usd, background: chainCol(c.name) }} className={sel === c.name ? 'sel' : ''} />)}</div>
      {chainRows.map(c => <button className={'arow' + (sel === c.name ? ' sel' : '')} key={c.name} onMouseEnter={() => setSel(c.name)} onMouseLeave={() => setSel(null)} onClick={() => setSel(sel === c.name ? null : c.name)}>
        <span className="dot" style={{ background: chainCol(c.name) }} /><span className="grow">{c.name}</span>
        <span className="pct">{(c.usd / (sum || 1) * 100).toFixed(1)}%</span>
        <span className={'num w' + (hide ? ' blurred' : '')}><Money v={c.usd} cls="sm" /></span></button>)}
    </section>}
    {!empty && <section>
      <div className="sechead"><Label>ASSETS</Label><span className="label">SPEND ORDER</span></div>
      {isLive && live.loading && !live.holdings.length && [0, 1, 2].map(i => <div className="asset skel" key={i}><i /><span className="grow"><b /><b /></span></div>)}
      {rows.map((a, i) => <div className="asset" key={i}>
        <Glyph s={a.sym} />
        <span className="grow"><span className="aname">{a.sym}</span><span className="sub">{a.chain} · {a.role}</span></span>
        <span className={'r' + (hide ? ' blurred' : '')}><Money v={a.usd} cls="sm" /><span className="sub">{a.amt.toLocaleString('en-US', { maximumFractionDigits: 4 })} {a.sym}{a.d24 !== null && <span className={a.d24 < 0 ? 'neg' : ''}> · {a.d24 > 0 ? '+' : ''}{a.d24.toFixed(1)}%</span>}</span></span>
      </div>)}
    </section>}
  </>
}

function HomeDesk(p: any) {
  const { hidden: hide, setHidden, mode, setMode, live, addrs, setAddrs, refresh, isLive, rows, chainRows, sum, v, empty, range, setRange, sel, setSel, go } = p
  const [to, setTo] = useState('@tolu'), [amt, setAmt] = useState('50')
  return <div className="dash">
    <section className="d-card d-hero">
      <div className="modes">{(['example', 'live'] as Mode[]).map(m => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'live' ? 'Watch-only · live' : 'Example data'}{mode === m && <motion.i layoutId="md" transition={spring} />}</button>)}</div>
      <Label>TOTAL BALANCE {isLive ? <span className="live-tag">LIVE · READ-ONLY</span> : <Example />}</Label>
      <button className={'total' + (hide ? ' blurred' : '') + (isLive && live.loading && !live.at ? ' loading' : '')} onClick={() => setHidden(!hide)} aria-label="Click to hide balance"><Money v={v} /></button>
      <div className="delta">{isLive ? <span className="dim">{live.loading ? <Dots size={5} label="Reading balances" /> : live.at ? `${addrs.length} address${addrs.length === 1 ? '' : 'es'} · live` : 'Add an address'}</span>
        : <><span>+$38.62</span><span className="dim">+1.37% · 24h</span><span className="dim">·</span><span className="dim">click to hide</span></>}</div>
      {!isLive && <div className="d-chart"><Spark range={range} />
        <div className="ranges">{['1D', '1W', '1M', '1Y'].map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r}{range === r && <motion.i layoutId="rg" transition={spring} />}</button>)}</div></div>}
    </section>
    <section className="d-card d-quick">
      <Label>QUICK PAY</Label>
      <input className="field" value={to} onChange={e => setTo(e.target.value)} aria-label="Recipient" />
      <div className="amount sm"><span>$</span><input value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" aria-label="Amount" /></div>
      <button className="cta" onClick={() => go('pay', to, amt)}>Review payment</button>
      <div className="d-swapq">
        <div><Label>QUICK SWAP</Label><div className="mono xs dim">SOL ⇄ USDC · NEAR Intents · live quotes</div></div>
        <button className="ghost" onClick={() => go('swap')}>Open swap →</button>
      </div>
    </section>
    {isLive && <section className="d-card d-watch"><Watch addrs={addrs} setAddrs={setAddrs} live={live} refresh={refresh} /></section>}
    {!empty && <section className="d-card d-chains">
      <div className="sechead"><Label>BY CHAIN</Label><span className="label">{chainRows.length} CHAINS</span></div>
      <table className="tbl"><thead><tr><th>Chain</th><th>Share</th><th className="rt">%</th><th className="rt">Value</th></tr></thead><tbody>
        {chainRows.map((c: any) => <tr key={c.name} className={sel === c.name ? 'sel' : ''} onMouseEnter={() => setSel(c.name)} onMouseLeave={() => setSel(null)}>
          <td><span className="dot" style={{ background: chainCol(c.name) }} /> {c.name}</td><td className="sharec"><i style={{ width: (c.usd / (sum || 1) * 100) + '%', background: chainCol(c.name) }} /></td>
          <td className="rt mono">{(c.usd / (sum || 1) * 100).toFixed(1)}</td><td className={'rt' + (hide ? ' blurred' : '')}><Money v={c.usd} cls="sm" /></td></tr>)}
      </tbody></table>
    </section>}
    {!empty && <section className="d-card d-assets">
      <div className="sechead"><Label>ASSETS</Label><span className="label">SPEND ORDER</span></div>
      <table className="tbl"><thead><tr><th>Asset</th><th>Chain</th><th>Role</th><th className="rt">Amount</th><th className="rt">24h</th><th className="rt">Value</th></tr></thead><tbody>
        {rows.map((a: any, i: number) => <tr key={i}><td><span className="tcell"><Glyph s={a.sym} /><b>{a.sym}</b></span></td><td className="dim">{a.chain}</td><td className="dim">{a.role}</td>
          <td className={'rt mono' + (hide ? ' blurred' : '')}>{a.amt.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
          <td className={'rt mono' + (a.d24 !== null && a.d24 < 0 ? ' neg' : '')}>{a.d24 === null ? '—' : (a.d24 > 0 ? '+' : '') + a.d24.toFixed(1) + '%'}</td>
          <td className={'rt' + (hide ? ' blurred' : '')}><Money v={a.usd} cls="sm" /></td></tr>)}
      </tbody></table>
    </section>}
    <section className="d-card d-feed">
      <div className="sechead"><Label>ORI ACTIVITY · POLICY EVENTS</Label><span><button className="label linkish" onClick={() => go('policy')}>POLICY →</button> <button className="label linkish" onClick={() => go('scan')}>SCANNER →</button></span></div>
      <Feed max={6} />
    </section>
    <section className="d-card d-act">
      <div className="sechead"><Label>RECENT ACTIVITY <Example /></Label></div>
      {activity.map((a, i) => <div className="row" key={i}><span className="grow">{a.t} <span className="dim">· {a.who}</span><br /><span className="mono xs dim">{a.note} · {a.when}</span></span>
        <span className={'num' + (hide ? ' blurred' : '')}>{a.amt ? (a.amt > 0 ? '+' : '−') + usd(Math.abs(a.amt)) : '—'}</span></div>)}
    </section>
  </div>
}

function useQuote(args: Parameters<typeof quote>[0] | null, dep: string) {
  const [st, setSt] = useState<{ q: Quote | null; loading: boolean; err: string | null }>({ q: null, loading: false, err: null })
  useEffect(() => {
    if (!args) { setSt({ q: null, loading: false, err: null }); return }
    let dead = false; setSt(s => ({ ...s, loading: true, err: null }))
    const t = setTimeout(() => quote(args).then(q => !dead && setSt({ q, loading: false, err: null })).catch(e => !dead && setSt({ q: null, loading: false, err: e.message })), 450)
    return () => { dead = true; clearTimeout(t) }
  }, [dep])
  return st
}
const fmtT = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export type Draft = { to: string; amt: string; k: number }
const FLAGGED = /drain|scam|claim-airdrop/i // local demo heuristic for handles; real addresses go to GoPlus
function ConfirmBtn({ label, need, blocked, limit, status, busyLabel, onGo, onLimit, btn }: { label: string; need: boolean; blocked: string | null; limit: string | null; status: string; busyLabel: string; onGo: (r: DOMRect) => void; onLimit: (r: DOMRect, why: string) => void; btn?: React.RefObject<HTMLButtonElement | null> }) {
  const own = useRef<HTMLButtonElement>(null); const cta = btn || own
  const [hold, setHold] = useState(false); const timer = useRef(0)
  const go = () => { const r = cta.current!.getBoundingClientRect(); if (limit) { onLimit(r, limit); return } onGo(r) }
  const start = () => { if (blocked || status !== 'idle') return; if (limit) { go(); return } if (!need) return; setHold(true); timer.current = window.setTimeout(() => { setHold(false); go() }, 750) }
  const cancel = () => { clearTimeout(timer.current); setHold(false) }
  return <button ref={cta} className={'cta hold sa2' + (hold ? ' holding' : '') + (limit && status === 'idle' ? ' over' : '')} disabled={!!blocked || status !== 'idle'}
    onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onClick={() => { if (!need && !limit && !blocked && status === 'idle') go() }}>
    <span className="fill" />{blocked ? blocked : status === 'running' ? <Dots size={7} label={busyLabel} /> : status === 'done' ? <Check size={26} /> : limit ? 'Over your limit · review' : (need ? 'Hold to ' : 'Tap to ') + label}</button>
}

function Pay({ draft, status, onConfirm, onRisk, onEvent, refundTo, cfg, onLimit }: { draft: Draft; status: 'idle' | 'running' | 'done' | 'sent'; onConfirm: (r: DOMRect, amt: number, to: string, fee: number | null) => void; onRisk: (r: DOMRect | null, why?: string) => void; onEvent: (t: string) => void; refundTo: string; cfg: Settings; onLimit: (r: DOMRect, why: string, what: string) => void }) {
  const [to, setTo] = useState(draft.to)
  const [amt, setAmt] = useState(draft.amt)
  const [checked, setChecked] = useState(false)
  const cta = useRef<HTMLButtonElement>(null)
  useEffect(() => { setTo(draft.to); setAmt(draft.amt) }, [draft.k])
  const [risk, setRisk] = useState<Risk | null>(null)
  useEffect(() => { setChecked(false); setRisk(null); let dead = false
    if (!cfg.scam) { setChecked(true); return }
    const t = setTimeout(async () => { const r = await goplus(to.trim()); if (dead) return; setRisk(r); setChecked(true); if (r.state === 'error') onEvent('Couldn’t reach GoPlus. Treat this address with care.') }, 500)
    return () => { dead = true; clearTimeout(t) } }, [to, cfg.scam])
  const local = cfg.scam && FLAGGED.test(to)
  const flagged = local || risk?.state === 'flagged'
  const why = risk?.state === 'flagged' ? `GoPlus flags this address: ${risk.flags.join(', ')}.` : 'That handle matches a known drainer pattern.'
  useEffect(() => { if (checked && flagged) logBlocked(`Payment to ${to}`, why); onRisk(checked && flagged && cta.current ? cta.current.getBoundingClientRect() : null, why) }, [checked, flagged])
  const n0 = +amt || 0
  const solTo = kindOf(to.trim()) === 'sol'
  const q = useQuote(n0 > 0 ? { from: ASSET.baseUSDC, to: ASSET.solUSDC, amount: BigInt(Math.round(n0 * 1e6)), recipient: solTo ? to.trim() : PREVIEW.sol, refundTo, outDecimals: 6 } : null, `${n0}|${solTo ? to : ''}|${refundTo}`)
  useEffect(() => () => onRisk(null), [])
  const trusted = cfg.trusted.includes(to.trim())
  const st = (ok: string) => !cfg.scam ? 'CHECK OFF' : !checked ? 'CHECKING…' : flagged ? 'BLOCKED' : ok
  const n = n0
  const limit = n > 0 ? limitCheck(cfg, n) : null
  return <div className="split pay-split">
    <section className="pad-top sa">
      <Label>PAY · TO @HANDLE OR ADDRESS {trusted && <span className="live-tag">TRUSTED</span>}</Label>
      <input className="field" value={to} onChange={e => setTo(e.target.value)} disabled={status !== 'idle'} />
      <div className="amount"><span>$</span><input value={amt} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" disabled={status !== 'idle'} /></div>
      <div className="mono dim xs">They receive USDC on Solana · their choice of chain{limit ? <><br /><span className="limitnote">{limit}</span></> : n > cfg.holdAbove ? ` · hold required above ${usd(cfg.holdAbove)}` : ''}</div>
    </section>
    <div className="sbw">
    <section className="sb">
      <Label>BEST ROUTE · NEAR INTENTS <LiveTag q={q} /></Label>
      <div className="route">
        <div className="step"><span className="mono xs dim">FROM</span><span>USDC · Base</span><span className="num">{q.q ? usd(q.q.amountInUsd) : usd(n)}</span></div>
        <div className="line" />
        <div className="step"><span className="mono xs dim">VIA</span><span>Solver quote · 1Click</span><span className={'num' + (q.loading ? ' pulse' : '')}>{q.q ? `~${q.q.eta}s` : q.loading ? <Dots size={4} /> : '—'}</span></div>
        <div className="line" />
        <div className="step"><span className="mono xs dim">TO</span><span>USDC · Solana</span><span className={'num' + (q.loading ? ' pulse' : '')}>{q.q ? q.q.amountOut.toFixed(2) + ' USDC' : q.loading ? <Dots size={4} /> : '—'}</span></div>
      </div>
      <QuoteMeta q={q} extra={solTo ? null : 'Quote uses a preview Solana recipient; handle → address lookup is still mocked.'} />
    </section>
    <section className="sb">
      <Label>SCAM CHECK {!cfg.scam && <span className="live-tag dimtag">OFF</span>}</Label>
      <div className="row"><span className="grow">Recipient address<br /><span className="mono xs dim">{!cfg.scam ? 'Scam check is off in Security' : !checked ? 'GoPlus address security…' : risk?.state === 'flagged' ? risk.flags.join(' · ') : risk?.state === 'unsupported' ? (local ? 'local pattern match' : 'Not an EVM address · GoPlus check skipped') : risk?.state === 'error' ? 'GoPlus unreachable · ' + risk.source : risk?.source}</span></span><span className={'mono xs' + (flagged && checked ? ' bad' : '')}>{!cfg.scam ? 'OFF' : !checked ? 'CHECKING…' : flagged ? 'BLOCKED' : risk?.state === 'clean' ? 'CLEAN · LIVE' : risk?.state === 'error' ? 'UNVERIFIED' : 'NOT CHECKED'}</span></div>
      <div className="row"><span className="grow">Token contract</span><span className="mono xs">{checked ? 'USDC · CANONICAL' : 'CHECKING…'}</span></div>
      <div className="row"><span className="grow">Drainer / approval risk</span><span className={'mono xs' + (flagged && checked ? ' bad' : '')}>{st('NO APPROVAL NEEDED')}</span></div>
      <div className="row"><span className="grow">Spending limits</span><span className={'mono xs' + (limit ? ' bad' : '')}>{limit ? 'OVER CAP' : `${usd(Math.max(0, cfg.daily - spentToday()))} LEFT TODAY`}</span></div>
    </section></div>
    {status === 'sent'
      ? <motion.div className="receipt sa2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <Label>RECEIPT <span className="example">SIMULATED</span></Label>
        <div className="money-r">{usd(n)} <span className="dim">sent to {to}</span></div>
        <div className="row"><span className="grow">Route</span><span className="num">Base USDC → Solana USDC</span></div>
        <div className="row"><span className="grow">Settled via</span><span className="num">NEAR Intents · simulated</span></div>
        <div className="row"><span className="grow">Quoted fee</span><span className="num">{q.q ? usd(q.q.fee) : '—'}</span></div>
        <div className="row"><span className="grow">Delivered by</span><span className="num">Ori</span></div>
      </motion.div>
      : <ConfirmBtn btn={cta} label={`review ${usd(n)} payment`} need={false} blocked={!checked ? null : flagged ? 'Blocked · flagged address' : null} limit={limit} status={status === 'idle' && !checked ? 'idle' : status} busyLabel="Ori is delivering"
        onGo={r => { if (checked) nebulaThink(); return checked && onConfirm(r, n, to, q.q ? q.q.fee : null) }} onLimit={(r, w) => onLimit(r, w, `Payment of ${usd(n)} to ${to}`)} />}
  </div>
}

function LiveTag({ q }: { q: { q: Quote | null; loading: boolean; err: string | null } }) {
  return q.q ? <span className="live-tag">LIVE QUOTE</span> : q.loading ? <span className="live-tag dimtag"><Dots size={4} label="Fetching quote" /></span> : q.err ? <span className="live-tag dimtag">OFFLINE</span> : null
}
function QuoteMeta({ q, extra }: { q: { q: Quote | null; loading: boolean; err: string | null }; extra: string | null }) {
  if (q.err) return <div className="mono xs err why">Live quote unavailable: {q.err}. Nothing was sent.</div>
  if (!q.q) return <div className="mono xs dim why">{q.loading ? <Dots size={5} label="Asking solvers" /> : 'Enter an amount for a live quote.'}</div>
  return <div className="mono xs dim why">Fee {usd(q.q.fee)} ({(q.q.fee / q.q.amountInUsd * 100).toFixed(2)}%) · min out {q.q.minOut.toFixed(2)} · 1% slippage · ETA ~{q.q.eta}s · quoted {fmtT(q.q.at)}<br />Dry-run only (dry:true): no deposit address is issued and nothing can be sent.{extra ? <><br />{extra}</> : null}</div>
}
function Swap({ refundEvm, preset, status, cfg, onConfirm, onLimit }: { refundEvm: string; preset: { amt: string; flip: boolean; k: number }; status: 'idle' | 'running' | 'done' | 'sent'; cfg: Settings; onConfirm: (r: DOMRect, usdv: number, detail: string, fee: number | null) => void; onLimit: (r: DOMRect, why: string, what: string) => void }) {
  const [flip, setFlip] = useState(preset.flip)
  const [amt, setAmt] = useState(preset.amt)
  useEffect(() => { setFlip(preset.flip); setAmt(preset.amt) }, [preset.k])
  const [px, setPx] = useState<{ sol: number; usdc: number } | null>(null)
  useEffect(() => { tokens().then(ts => setPx({ sol: ts.find(t => t.assetId === ASSET.SOL)!.price, usdc: ts.find(t => t.assetId === ASSET.baseUSDC)!.price })).catch(() => { }) }, [])
  const n = +amt || 0
  const from = flip ? { s: 'USDC', c: 'Base', id: ASSET.baseUSDC, d: 6, p: px?.usdc } : { s: 'SOL', c: 'Solana', id: ASSET.SOL, d: 9, p: px?.sol }
  const to = flip ? { s: 'SOL', c: 'Solana', id: ASSET.SOL, d: 9, p: px?.sol } : { s: 'USDC', c: 'Base', id: ASSET.baseUSDC, d: 6, p: px?.usdc }
  const q = useQuote(n > 0 ? { from: from.id, to: to.id, amount: BigInt(Math.round(n * 10 ** from.d)), recipient: to.c === 'Base' ? refundEvm : PREVIEW.sol, refundTo: from.c === 'Base' ? refundEvm : PREVIEW.sol, outDecimals: to.d } : null, `${n}|${flip}`)
  const out = q.q ? q.q.amountOut : null
  const fmtOut = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: to.d === 9 ? 4 : 2 })
  const usdv = q.q ? q.q.amountInUsd : n * (from.p || 0)
  const limit = usdv > 0 ? limitCheck(cfg, usdv) : null
  const [sent, setSent] = useState<{ q: Quote; n: number; from: string; to: string } | null>(null)
  const busy = status !== 'idle'
  return <div className="split swap-split">
    <section className="pad-top sa">
      <Label>SWAP · ONE TAP {px && <span className="live-tag">LIVE PRICES</span>}</Label>
      <div className="swapbox">
        <span className="mono xs dim">SEND</span>
        <div className="swaprow"><input className="big2 amtin" value={amt} disabled={busy} onChange={e => setAmt(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" /><span>{from.s}<br /><span className="mono xs dim">{from.c}</span></span></div>
        <span className="mono xs dim">{from.p ? usd(n * from.p) : '—'}</span>
        <motion.button className="flip" whileTap={{ rotate: 180 }} transition={spring} disabled={busy} onClick={() => setFlip(!flip)} aria-label="Flip direction">⇅</motion.button>
      </div>
      <div className="swapbox">
        <span className="mono xs dim">RECEIVE</span>
        <div className="swaprow"><span className={'big2' + (q.loading ? ' pulse' : '')}>{out !== null ? fmtOut(out) : '—'}</span><span>{to.s}<br /><span className="mono xs dim">{to.c}</span></span></div>
        <span className="mono xs dim">{q.q ? usd(q.q.amountOutUsd) : ' '}{limit && <span className="limitnote"> · {limit}</span>}</span>
      </div>
    </section>
    <section className="sb">
      <Label>QUOTE <LiveTag q={q} /></Label>
      <div className="row"><span className="grow">Rate</span><span className="num">{q.q && n ? `1 ${from.s} = ${(q.q.amountOut / n).toLocaleString('en-US', { maximumFractionDigits: 4 })} ${to.s}` : '—'}</span></div>
      <div className="row"><span className="grow">Settlement</span><span className="num">NEAR Intents · {q.q ? `~${q.q.eta}s` : '—'}</span></div>
      <div className="row"><span className="grow">Total fee</span><span className="num">{q.q ? usd(q.q.fee) : '—'}</span></div>
      <div className="row"><span className="grow">Minimum received</span><span className="num">{q.q ? fmtOut(q.q.minOut) + ' ' + to.s : '—'}</span></div>
      <QuoteMeta q={q} extra="Confirming runs a simulation with these live numbers. Nothing is signed or sent." />
    </section>
    {status === 'sent' && sent
      ? <motion.div className="receipt sa2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <Label>SWAP RECEIPT <span className="example">SIMULATED</span></Label>
        <div className="money-r">{sent.n} {sent.from} <span className="dim">→ {fmtOut(sent.q.amountOut)} {sent.to}</span></div>
        <div className="row"><span className="grow">Value in</span><span className="num">{usd(sent.q.amountInUsd)}</span></div>
        <div className="row"><span className="grow">Quoted fee</span><span className="num">{usd(sent.q.fee)}</span></div>
        <div className="row"><span className="grow">Settled via</span><span className="num">NEAR Intents · simulated · ~{sent.q.eta}s</span></div>
        <div className="row"><span className="grow">Quote time</span><span className="num">{fmtT(sent.q.at)} · dry run</span></div>
      </motion.div>
      : <ConfirmBtn label={`review swap ${n || ''} ${from.s} → ${to.s}`} need={false} blocked={!q.q ? (q.loading ? 'Waiting for a live quote' : q.err ? 'No live quote · cannot simulate' : 'Enter an amount') : null} limit={limit} status={status} busyLabel="Ori is swapping"
        onGo={r => { if (!q.q) return; nebulaThink(); setSent({ q: q.q, n, from: from.s, to: to.s }); onConfirm(r, q.q.amountInUsd, `${n} ${from.s} → ${fmtOut(q.q.amountOut)} ${to.s}`, q.q.fee) }} onLimit={(r, w) => onLimit(r, w, `Swap of ${n} ${from.s} (${usd(usdv)})`)} />}
  </div>
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

export function useWide() {
  const q = () => typeof matchMedia !== 'undefined' && matchMedia('(min-width:1024px)').matches
  const [w, setW] = useState(q)
  useEffect(() => { const m = matchMedia('(min-width:1024px)'); const f = () => setW(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return w
}
const activity = [
  { t: 'Received', who: '@ade', amt: 12, note: 'USDC · Base', when: 'Just now' },
  { t: 'Paid', who: '@tolu', amt: -50, note: 'Base USDC → Solana USDC', when: 'Today' },
  { t: 'Swapped', who: '1.2 SOL → USDC', amt: 0, note: 'NEAR Intents', when: 'Yesterday' },
  { t: 'Yield', who: 'Aave v3 · Base', amt: 1.38, note: 'Idle USDC', when: 'Mon' },
  { t: 'Received', who: '@kemi', amt: 200, note: 'USDT · Solana', when: 'Sun' },
]
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
type Msg = { who: 'me' | 'ori'; t: string; chips?: string[]; pending?: Act }
const MORE: Screen[] = ['policy', 'scan', 'earn', 'privacy', 'settings', 'security', 'help']
export default function App() {
  const initial = (new URLSearchParams(location.search).get('screen') as Screen) || 'home'
  const [screen, setScreen] = useState<Screen>(initial)
  const [hidden, setHidden] = useState(false)
  const [extra, setExtra] = useState(0)
  const [mode, setModeS] = useState<Mode>(() => (new URLSearchParams(location.search).get('mode') as Mode) || (localStorage.getItem('mode') as Mode) || 'example')
  const [addrs, setAddrsS] = useState<string[]>(() => { const q = new URLSearchParams(location.search).get('addrs'); return q ? q.split(',') : JSON.parse(localStorage.getItem('addrs') || '[]') })
  const [live, setLive] = useState<LiveState>({ loading: false, holdings: [], errors: [], at: null })
  const setMode = (m: Mode) => { setModeS(m); localStorage.setItem('mode', m) }
  const setAddrs = (a: string[]) => { setAddrsS(a); localStorage.setItem('addrs', JSON.stringify(a)) }
  const lastTotal = useRef<number | null>(null)
  const [draft, setDraft] = useState<Draft>({ to: '@tolu', amt: '50', k: 0 })
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'sent'>('idle')
  useEffect(() => { if (status === 'done' || status === 'sent') nebulaDone(600) }, [status])
  const [chat, setChat] = useState(false)
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null)
  const [stage, skipIntro] = useIntro()
  const wide = useWide()
  const [menu, setMenu] = useState(new URLSearchParams(location.search).get('menu') === '1')
  const [msgs, setMsgs] = useState<Msg[]>([{ who: 'ori', t: 'Hi, I’m Ori. Ask me about your balance, prices, safety, or tell me to pay or swap. I always show you a card to confirm first.', chips: DEFAULT_CHIPS }])
  const [thinking, setThinking] = useState(false)
  const [cfg, setCfg] = useSettings()
  setFmt(cfg.fmt)
  const [swapSt, setSwapSt] = useState<'idle' | 'running' | 'done' | 'sent'>('idle')
  const [swapPre, setSwapPre] = useState({ amt: '1', flip: false, k: 0 })
  const msgsEnd = useRef<HTMLDivElement>(null)
  useEffect(() => { msgsEnd.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, thinking, chat])
  const [input, setInput] = useState('')
  const [mic, setMic] = useState<'off' | 'listening' | 'unsupported' | 'denied'>('off')
  const [heard, setHeard] = useState<string | null>(null)
  const ori = useRef<OriApi>(null)
  const stopMic = useRef<() => void>(() => { })
  const reduced = cfg.reduce || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => { if (reduced) return; const l = new Lenis({ lerp: 0.12 }); let r = 0; const f = (t: number) => { l.raf(t); r = requestAnimationFrame(f) }; r = requestAnimationFrame(f); return () => { cancelAnimationFrame(r); l.destroy() } }, [reduced])
  useEffect(() => { document.title = APP_NAME }, [])
  const refresh = async () => {
    if (!addrs.length) { setLive({ loading: false, holdings: [], errors: [], at: null }); return }
    setLive(l => ({ ...l, loading: true }))
    try {
      const r = await readPortfolio(addrs); const t = r.holdings.reduce((a, h) => a + h.usd, 0)
      setLive({ loading: false, holdings: r.holdings, errors: r.errors, at: Date.now() })
      if (lastTotal.current === null) ori.current?.say(`Read ${addrs.length - r.errors.length} of ${addrs.length} addresses. ${usd(t)} total, live.`, 3200)
      else if (t > lastTotal.current + 0.005) { ori.current?.hop(); ori.current?.say(`Up ${usd(t - lastTotal.current)} since last check.`, 2800) }
      if (r.errors.length) setTimeout(() => ori.current?.say(`I couldn’t read ${r.errors.length} address${r.errors.length > 1 ? 'es' : ''}. Details under the list.`, 3000), 3400)
      lastTotal.current = t
    } catch (e) { setLive(l => ({ ...l, loading: false, errors: ['Prices unavailable: ' + (e as Error).message] })); ori.current?.say('Price feed is down. Showing nothing rather than guessing.') }
  }
  useEffect(() => { if (mode !== 'live') return; lastTotal.current = null; refresh(); const i = setInterval(refresh, 60000); return () => clearInterval(i) }, [mode, addrs.join()])
  const refundEvm = addrs.find(a => kindOf(a) === 'evm') || PREVIEW.evm
  // example incoming payment → balance up → Ori hops (example mode only)
  useEffect(() => { if (mode !== 'example') return; const t = setTimeout(() => { setExtra(12); ori.current?.hop(); ori.current?.say('+$12.00 from @ade. Nice. (example)', 2800) }, 5200); return () => clearTimeout(t) }, [])
  // sheet open → Ori returns to rest on the sheet's edge
  useEffect(() => { if (!chat) { ori.current?.rest(null); return } if (wide) { const h = Math.min(560, innerHeight - 120); ori.current?.rest(innerHeight - 24 - h, innerWidth - 24 - 420 + 24) } else ori.current?.rest(innerHeight - 420) }, [chat, wide])

  const talk = (t: string, voice: boolean) => { if (voice && cfg.voice) speak(t, cfg.rate) }
  const oriSay = (t: string, voice = false, chips?: string[]) => { setMsgs(m => [...m, { who: 'ori', t, chips }]); ori.current?.say(t); talk(t, voice || chat) }
  const rows = mode === 'live' ? live.holdings.map(h => ({ sym: h.sym, chain: h.chain, amt: h.amt, usd: h.usd })) : assets.map((a, i) => ({ sym: a.sym, chain: a.chain, amt: a.amt, usd: a.usd + (i === 0 ? extra : 0) }))
  const goTo = (k: Screen) => { setScreen(k); setMenu(false); if (k === 'pay' && status === 'sent') setStatus('idle'); if (k === 'swap' && swapSt === 'sent') setSwapSt('idle'); scrollTo(0, 0) }
  const doAct = (a: Act) => {
    if (a.k === 'pay') { setStatus('idle'); setDraft({ to: a.to, amt: a.amt, k: Date.now() }); goTo('pay'); setChat(false) }
    else if (a.k === 'swap') { setSwapSt('idle'); setSwapPre({ amt: a.amt, flip: a.flip, k: Date.now() }); goTo('swap'); setChat(false) }
    else if (a.k === 'go') { goTo(a.screen as Screen); setChat(false) }
    else if (a.k === 'mode') setMode(a.m)
    else if (a.k === 'hide') setHidden(a.v)
    else if (a.k === 'set') setCfg(a.patch)
    else if (a.k === 'trust') { if (!cfg.trusted.includes(a.who)) setCfg({ trusted: [...cfg.trusted, a.who] }) }
  }
  const command = async (text: string, src = 'chat') => {
    setMsgs(m => [...m.map(x => ({ ...x, pending: undefined })), { who: 'me', t: text }]); setThinking(true); nebulaThink(); ori.current?.mood('think')
    let r: Reply
    try { r = await answer(text, { mode, hidden, rows, settings: cfg, spent: spentToday() }) } catch { r = { text: 'Something went wrong on my side. Try again?' } }
    setThinking(false); nebulaDone(); const v = src !== 'chat'
    if (r.mood) ori.current?.mood(r.mood)
    if (r.act && r.confirm) { setMsgs(m => [...m, { who: 'ori', t: r.text, chips: r.chips, pending: r.act }]); ori.current?.say(r.text); talk(r.text, v || chat); return }
    oriSay(r.text, v, r.chips)
    if (r.act) setTimeout(() => doAct(r.act!), r.act.k === 'pay' || r.act.k === 'swap' || r.act.k === 'go' ? 600 : 0)
  }
  const resolve = (i: number, ok: boolean) => { const m = msgs[i]; if (!m?.pending) return; setMsgs(ms => ms.map((x, j) => j === i ? { ...x, pending: undefined } : x)); if (ok) { doAct(m.pending); oriSay(m.pending.k === 'set' ? `Done: ${m.pending.label}.` : m.pending.k === 'trust' ? `${m.pending.who} is now trusted.` : m.pending.k === 'mode' ? `Switched to ${m.pending.m} mode.` : 'Done.'); ori.current?.mood('happy') } else oriSay('Okay, left it as it was.') }
  const askIn = useRef<HTMLInputElement>(null)
  const openChat = () => { setChat(true); askIn.current?.focus({ preventScroll: true }) }
  useEffect(() => { if (!chat) askIn.current?.blur() }, [chat])
  const ask = (q?: string) => { openChat(); if (q) command(q) }
  const wake = (src: string) => { if (!cfg.wake) return; ori.current?.listen(); setHeard(src === 'simulated' ? '“Hey Ori” · simulated' : '“Hey Ori”'); oriSay('Hey! What do you need?', true) }
  // single entry for speech results (real mic and the demo simulation both call this)
  const heardCb = { onWake: wake, onCommand: (t: string, src: string) => { setHeard(`“${t}”${src === 'simulated' ? ' · simulated' : ''}`); command(t, src) }, onState: (s: string) => setMic(s as any) }
  useEffect(() => { (window as any).__ori = { hear: (t: string) => handleHeard(t, heardCb, 'simulated') } })
  const toggleMic = () => { if (!cfg.wake) { oriSay('The “Hey Ori” wake word is off. Turn it on in Settings, or click me to type.'); return } if (mic === 'listening') { stopMic.current(); return } if (!speechSupported()) { setMic('unsupported'); oriSay('Voice isn’t supported in this browser. Tap me to talk instead.'); return } stopMic.current = startListening(heardCb) }
  const celebrate = async (r: DOMRect, set: (v: 'idle' | 'running' | 'done' | 'sent') => void) => { set('running'); await ori.current?.run(r); set('done'); await wait(reduced ? 200 : 650); setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); await wait(reduced ? 0 : 700); set('sent'); setTimeout(() => setBurst(null), reduced ? 300 : 900); ori.current?.mood('happy') }
  const [sheet, setSheet] = useState<(SheetData & { run?: () => void }) | null>(null)
  const confirm = (r: DOMRect, amt: number, to: string, fee: number | null) => setSheet({ kind: 'pay', to, amount: `${usd(amt)} USDC`, usdv: amt, chain: 'Base → Solana', fee, blocked: null, run: () => doPay(r, amt, to) })
  const confirmSwap = (r: DOMRect, v: number, detail: string, fee: number | null) => setSheet({ kind: 'swap', to: 'Your ORI wallet', amount: detail, usdv: v, chain: /SOL →/.test(detail) ? 'Solana → Base' : 'Base → Solana', fee, blocked: null, run: () => doSwap(r, v, detail) })
  const doPay = async (r: DOMRect, amt: number, to: string) => { await celebrate(r, setStatus); addSpent(amt); setExtra(e => e - amt); oriSay(`Delivered ${usd(amt)} to ${to}. Simulated, nothing was signed. Receipt’s on the card.`) }
  const doSwap = async (r: DOMRect, v: number, detail: string) => { await celebrate(r, setSwapSt); addSpent(v); oriSay(`Swapped ${detail}, simulated at the live quote. Nothing was signed.`) }
  const overLimit = (r: DOMRect, why: string, what: string) => { logBlocked(what, why); { const m = what.match(/^(Payment|Swap) of (.+?)(?: to (.+))?$/); setSheet({ kind: m?.[1] === 'Swap' ? 'swap' : 'pay', to: m?.[3] || 'Your ORI wallet', amount: m?.[2] || what, usdv: +(what.match(/\$([\d,.]+)/)?.[1] || '0').replace(/,/g, ''), chain: m?.[1] === 'Swap' ? 'Solana ⇄ Base' : 'Base → Solana', fee: null, blocked: why }) } ori.current?.block(r); ori.current?.mood('worried'); oriSay(`I stopped that. ${why} You can change your limits in Policy.`, false, ['Open policy', 'What are my limits?']); setTimeout(() => ori.current?.block(null), 3200) }


  return <LayoutGroup><div className={'app' + (stage !== 'done' ? ' intro-on' : '') + (stage === 'land' ? ' landing' : '')}>
    <div className="grain" />
    <Nebula reduce={reduced} dim={wide ? 1 : 0.9} active={screen === 'home' || thinking} />
    {wide && <aside className="side">
      <div className="side-logo">{stage === 'land' || stage === 'done' ? <motion.span layoutId="wordmark" className="logo" transition={{ type: 'spring', stiffness: 170, damping: 24 }}><LogoH h={wide ? 30 : 22} /></motion.span> : <span className="logo" style={{ opacity: 0 }}><LogoH h={wide ? 30 : 22} /></span>}</div>
      <div className="side-nav">
        {([['home', 'Home'], ['pay', 'Pay'], ['swap', 'Swap'], ['policy', 'Policy & limits'], ['scan', 'Scanner'], ['earn', 'Earn'], ['privacy', 'Privacy'], ['settings', 'Settings'], ['security', 'Security'], ['help', 'Help']] as const).map(([k, label], i) => <Fragment key={k}>
          {i === 3 && <p className="mono xs dim side-sep">MORE</p>}
          <button className={'side-item' + (screen === k ? ' on' : '') + ''} onClick={() => goTo(k as Screen)}>
            {label}{screen === k && <motion.i layoutId="sidenav" transition={spring} />}</button></Fragment>)}
      </div>
      <button className="side-ask" onClick={() => ask()}><span className="dot" />Ask Ori anything<span className="mono xs dim">CLICK</span></button>
      <p className="mono xs dim side-foot">Preview · {mode === 'live' ? 'live watch-only' : 'example data'} · nothing is signed</p>
    </aside>}
    {wide && <button className={'mic top-mic ' + mic} onClick={() => { openChat(); toggleMic() }} aria-pressed={mic === 'listening'} title="Listen for “Hey Ori”">
        <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
        <span className="mono xs">{!cfg.wake ? 'WAKE OFF' : mic === 'listening' ? 'HEY ORI · ON' : mic === 'unsupported' ? 'CLICK ORI' : mic === 'denied' ? 'MIC BLOCKED' : 'HEY ORI'}</span></button>}
    {!wide && <header>{stage === 'land' || stage === 'done' ? <motion.span layoutId="wordmark" className="logo" transition={{ type: 'spring', stiffness: 170, damping: 24 }}><LogoH h={wide ? 30 : 22} /></motion.span> : <span className="logo" style={{ opacity: 0 }}><LogoH h={wide ? 30 : 22} /></span>}
      <button className={'mic ' + mic} onClick={() => { openChat(); toggleMic() }} aria-pressed={mic === 'listening'} title="Listen for “Hey Ori”">
        <svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
        <span className="mono xs">{mic === 'listening' ? 'HEY ORI · ON' : mic === 'unsupported' ? 'TAP ORI' : mic === 'denied' ? 'MIC BLOCKED' : 'HEY ORI'}</span></button></header>}
    <AnimatePresence>{heard && <motion.div className="heard mono xs" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onAnimationComplete={() => setTimeout(() => setHeard(null), 3500)}>HEARD {heard}</motion.div>}</AnimatePresence>
    <AnimatePresence mode="wait">
      <motion.main key={screen} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
        {screen === 'home' && <Home hidden={hidden} setHidden={setHidden} extra={extra} mode={mode} setMode={setMode} live={live} addrs={addrs} setAddrs={setAddrs} refresh={refresh} wide={wide} go={(s, to, amt) => { if (s === 'pay' && to) { setStatus('idle'); setDraft({ to, amt: amt || '0', k: Date.now() }) } setScreen(s); scrollTo(0, 0) }} />}
        {screen === 'pay' && <Pay draft={draft} status={status} cfg={cfg} onLimit={overLimit} onConfirm={confirm} onRisk={(r, why) => { ori.current?.block(r); if (r && why) { ori.current?.mood('worried'); ori.current?.say('Stop. ' + why, 4000) } }} onEvent={t => ori.current?.say(t)} refundTo={refundEvm} />}
        {screen === 'swap' && <Swap refundEvm={refundEvm} preset={swapPre} status={swapSt} cfg={cfg} onConfirm={confirmSwap} onLimit={overLimit} />}
        {screen === 'settings' && <SettingsScreen s={cfg} set={setCfg} mode={mode} setMode={setMode} speechOk={speechSupported()} watch={<Watch addrs={addrs} setAddrs={setAddrs} live={live} refresh={refresh} />} />}
        {screen === 'security' && <SecurityScreen s={cfg} set={setCfg} />}
        {screen === 'policy' && <PolicyScreen s={cfg} set={setCfg} />}
        {screen === 'scan' && <ScanScreen />}
        {screen === 'help' && <HelpScreen ask={ask} />}
        {screen === 'earn' && <Earn />}
        {screen === 'privacy' && <Privacy hidden={hidden} setHidden={setHidden} />}
      </motion.main>
    </AnimatePresence>
    {!wide && <nav>{(['home', 'pay', 'swap'] as Screen[]).map((t) => <button key={t} onClick={() => goTo(t)} className={screen === t && !menu ? 'on' : ''}>
      {t}
      {screen === t && !menu && <motion.i layoutId="nav" transition={spring} />}</button>)}
      <button className={menu || MORE.includes(screen) ? 'on' : ''} onClick={() => setMenu(!menu)} aria-label="Menu">
        <span className="burger" aria-hidden><motion.b animate={menu ? { rotate: 45, y: 3 } : { rotate: 0, y: 0 }} transition={spring} /><motion.b animate={menu ? { rotate: -45, y: -3 } : { rotate: 0, y: 0 }} transition={spring} /></span>More
        {(menu || MORE.includes(screen)) && <motion.i layoutId="nav" transition={spring} />}</button></nav>}
    <AnimatePresence>{menu && <>
      <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
      <motion.div className="drawer" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}>
        <div className="grab" />
        <p className="mono xs dim">MORE</p>
        {([['policy', 'Policy & limits', 'Caps, approval threshold, allowlist'], ['scan', 'Scanner', 'Risky tokens and approvals'], ['earn', 'Earn', 'Safe, capped yield on stablecoins'], ['privacy', 'Privacy', 'Hidden balances, private routes'], ['settings', 'Settings', 'Addresses, data mode, voice'], ['security', 'Security', 'Scam checks, spending limits'], ['help', 'Help', 'How ORI works']] as const).map(([k, label, sub], i) =>
          <motion.button key={k} className="drow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.04 * i }}
            onClick={() => goTo(k)}>
            <span className="dl">{label}<small>{sub}</small></span><span className="arr" aria-hidden>→</span></motion.button>)}
      </motion.div></>}</AnimatePresence>
    <AnimatePresence>{chat && <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setChat(false)} />}</AnimatePresence>
    {/* sheet stays mounted so the input can be focused synchronously inside the tap gesture (iOS only shows the keyboard then) */}
      <motion.div className={'sheet' + (chat ? ' open' : '')} initial={false} animate={{ y: chat ? 0 : 'calc(100% + 140px)', opacity: chat ? 1 : 0 }} transition={spring} aria-hidden={!chat}>
        <div className="sheet-head"><Label>ORI · LOCAL ASSISTANT · NO AI MODEL</Label><button className="mono xs dim" onClick={() => setChat(false)}>CLOSE</button></div>
        <div className="msgs" data-lenis-prevent>{msgs.slice(-14).map((m, k) => { const i = msgs.length - Math.min(14, msgs.length) + k; return <motion.div key={i} className={'msgw ' + (m.who === 'me' ? 'me' : 'bot')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <div className={'msg ' + (m.who === 'me' ? 'me' : 'bot')}>{m.t}</div>
          {m.pending && <div className="confirm-row"><button className="ghost" onClick={() => resolve(i, false)}>Cancel</button><button className="ghost ok" onClick={() => resolve(i, true)}>Confirm</button></div>}
          {m.who === 'ori' && m.chips && i === msgs.length - 1 && !thinking && <div className="chips">{m.chips.map(c => <button key={c} className="mono xs" onClick={() => command(c)}>{c}</button>)}</div>}
        </motion.div> })}
          {thinking && <div className="msg bot thinking"><Dots size={5} label="Ori is thinking" /></div>}<div ref={msgsEnd} /></div>
        <form onSubmit={e => { e.preventDefault(); if (input.trim() && !thinking) { command(input); setInput('') } }} className="ask">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask Ori: balance, prices, “pay tolu 20”…" ref={askIn} enterKeyHint="send" tabIndex={chat ? 0 : -1} /><button className="mono xs" disabled={thinking}>SEND</button></form>
      </motion.div>
    <div className={'ori-wrap' + (menu ? ' aside' : '') + (stage !== 'done' ? ' pre' : '')}><Ori ref={ori} hidden={hidden} reduced={reduced} screen={screen} onTap={() => { if (chat) setChat(false); else openChat() }} balance={hidden ? null : rows.reduce((a, r) => a + r.usd, 0)} chat={chat && wide} /></div>
    <AnimatePresence>{burst && <motion.div className="ripple" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .25 }} aria-hidden>
      {[0, 1, 2].map(i => <motion.i key={i} initial={{ scale: 0.2, opacity: 0.7 }} animate={{ scale: [0.2, 1.05, 0.95, 1.6 + i * 0.5], opacity: [0.7, 0.55, 0.4, 0] }} transition={{ duration: reduced ? 0 : 1.3, delay: reduced ? 0 : i * 0.18, ease: 'easeOut', times: [0, 0.35, 0.5, 1] }} />)}
      <motion.b initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.12, 1], opacity: 1 }} transition={{ duration: reduced ? 0 : 0.5, delay: reduced ? 0 : 0.35 }}><Check size={30} /></motion.b></motion.div>}</AnimatePresence>
    <AnimatePresence>{sheet && <ConfirmSheet key="cs" d={sheet} cfg={cfg} onCancel={() => { if (!sheet.blocked) oriSay('Cancelled. Nothing moved.'); setSheet(null) }} onConfirm={() => { const r = sheet.run; setSheet(null); r?.() }} />}</AnimatePresence>
    <Intro stage={stage} skip={skipIntro} />
  </div></LayoutGroup>
}
