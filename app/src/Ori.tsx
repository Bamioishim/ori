import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { motion, useMotionValue, animate, AnimatePresence } from 'motion/react'

export type Pose = 'idle' | 'walk' | 'float' | 'listen' | 'carry' | 'cover' | 'block' | 'sit' | 'peek'
export type OriApi = {
  say: (t: string, ms?: number) => void
  hop: () => void
  listen: () => void
  run: (from: DOMRect) => Promise<void>
  block: (r: DOMRect | null) => void
  rest: (bottomY: number | null, left?: number) => void
  mood: (m: 'happy' | 'worried' | 'think' | null) => void
}
export type Expr = 'none' | 'yawn' | 'sleep' | 'happy' | 'worried' | 'think'
const S = 56 // rendered size
const MODAL_SEL = '.csheet, .drawer, .scrim, [role="dialog"], [aria-modal="true"]'
const AVOID_SEL = '.d-card .row, .d-card .appr, .appr, .fitem, .pwarn, .csum, .cta, .field, .swapbox, .tbl, .sechead, .big2, .policy-sum, h1, h2, button, input, .d-card'
const M = '#7DF5D8', W = '#F2F1EC'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const rand = (a: number, b: number) => a + Math.random() * (b - a)

// Ori sprite: orb bot (concept 2) + Courier's cross-body bag & speed lines
export function OriSprite({ pose, face = 1, moving = false, look = { x: 0, y: 0 }, expr = 'none', big = false }: { pose: Pose; face?: number; moving?: boolean; look?: { x: number; y: number }; expr?: Expr; big?: boolean }) {
  const legs = pose === 'sit'
    ? <path d="M46 92 l-10 8 M74 92 l10 8" stroke={W} strokeWidth="4" strokeLinecap="round" />
    : pose === 'float'
      ? <path d="M50 92 q-2 8 2 12 M70 92 q2 8 -2 12" stroke={W} strokeWidth="4" strokeLinecap="round" fill="none" />
      : <g className={moving || pose === 'walk' || pose === 'carry' ? 'legs walking' : 'legs'}>
        <path className="lg1" d="M50 92 l-3 16 h-6" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path className="lg2" d="M70 92 l3 16 h6" stroke={W} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></g>
  const arms = pose === 'carry'
    ? <path d="M32 62 q-8 -18 8 -32 M88 62 q8 -18 -8 -32" stroke={W} strokeWidth="3.2" fill="none" strokeLinecap="round" />
    : pose === 'cover'
      ? <path d="M30 70 q10 -16 28 -12 M90 70 q-10 -16 -28 -12" stroke={W} strokeWidth="5" fill="none" strokeLinecap="round" />
      : pose === 'block'
        ? <path d="M30 62 l-20 -10 M90 62 l20 -10" stroke={W} strokeWidth="3.6" strokeLinecap="round" />
        : <path d="M31 66 q-6 8 -4 14 M89 66 q6 8 4 14" stroke={W} strokeWidth="3" fill="none" strokeLinecap="round" />
  const eyeX = (pose === 'listen' ? 66 : pose === 'peek' ? 70 : 60) + (expr === 'think' ? -5 : look.x * face), eyeY = 59 + (expr === 'think' ? -3 : look.y)
  const er = big ? 7 : 6
  return <svg viewBox="-14 -8 148 136" width={S * 1.23} height={S * 1.13} style={{ transform: `scaleX(${face})`, overflow: 'visible' }}>
    <defs>
      <radialGradient id="ori-orb" cx="38%" cy="30%" r="72%"><stop offset="0" stopColor="#ECEBE7" /><stop offset=".6" stopColor="#9A9A98" /><stop offset="1" stopColor="#363636" /></radialGradient>
      <filter id="ori-gl" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>
    {(pose === 'carry' || moving) && <g stroke="#6a6a6a" strokeWidth="3" strokeLinecap="round" className="speed"><path d="M-12 56 h16" /><path d="M-8 70 h14" /><path d="M-12 84 h16" /></g>}
    {legs}
    {pose === 'listen'
      ? <><path d="M60 30 q2 -10 -4 -16" stroke={W} strokeWidth="2.4" fill="none" /><circle cx="56" cy="13" r="3.4" fill={M} filter="url(#ori-gl)" />
        <g fill="none" stroke={M} strokeWidth="2.4" strokeLinecap="round" className="waves"><path d="M74 12 q6 8 0 16" /><path d="M82 6 q10 14 0 28" opacity=".55" /></g></>
      : <><path d="M60 30 v-12" stroke={W} strokeWidth="2.4" /><circle cx="60" cy="15" r="3.4" fill="#8a8a8a" /></>}
    <circle cx="60" cy="62" r="32" fill="url(#ori-orb)" />
    <rect x="38" y="48" width="44" height="22" rx="11" fill="#0B0B0B" />
    {expr === 'sleep'
      ? <path d="M52 60 q8 5 16 0" stroke={M} strokeWidth="3" fill="none" strokeLinecap="round" filter="url(#ori-gl)" />
      : expr === 'happy'
        ? <path d={`M${eyeX - 7} 62 q7 -9 14 0`} stroke={M} strokeWidth="3.4" fill="none" strokeLinecap="round" filter="url(#ori-gl)" />
        : expr === 'yawn'
          ? <ellipse cx={eyeX} cy="59" rx="6" ry="1.6" fill={M} filter="url(#ori-gl)" />
          : pose === 'block'
            ? <path d="M54 54 l12 10 M66 54 l-12 10" stroke={M} strokeWidth="3.2" strokeLinecap="round" filter="url(#ori-gl)" />
            : <><circle cx={eyeX} cy={eyeY} r={expr === 'worried' ? 4.6 : pose === 'listen' ? 7 : er} fill={M} filter="url(#ori-gl)" className={pose === 'idle' || pose === 'sit' ? 'blink' : undefined} /><circle cx={eyeX + 2.2} cy={eyeY - 2.2} r="1.9" fill="#0A0A0A" /></>}
    {expr === 'worried' && <path d={`M${eyeX - 8} 51 l14 -3`} stroke={M} strokeWidth="2.2" strokeLinecap="round" opacity=".85" />}
    {expr === 'yawn' && <ellipse cx="60" cy="80" rx="5" ry="6" fill="#0B0B0B" />}
    {expr === 'sleep' && <g className="zz" fill={W} fontFamily="ui-monospace,monospace" fontWeight="700"><text x="88" y="30" fontSize="13">z</text><text x="100" y="16" fontSize="10" opacity=".7">z</text></g>}
    {expr === 'think' && <g fill={W} opacity=".8"><circle cx="92" cy="34" r="2.4" /><circle cx="99" cy="25" r="3.2" /><circle cx="108" cy="14" r="4.2" /></g>}
    {/* courier cross-body bag */}
    <path d="M38 40 Q62 74 84 84" stroke="#4a4a4a" strokeWidth="3" fill="none" />
    <rect x="76" y="78" width="20" height="15" rx="3" fill="#2e2e2e" stroke={W} strokeWidth="1.4" />
    <path d="M76 84 h20" stroke={W} strokeWidth="1" opacity=".5" />
    {arms}
    {pose === 'carry' && <g filter="url(#ori-gl)"><circle cx="60" cy="16" r="13" fill="#0B0B0B" stroke={M} strokeWidth="2.6" /><circle cx="60" cy="16" r="5.5" fill={M} /></g>}
  </svg>
}

type Props = { hidden: boolean; reduced: boolean; screen: string; onTap: () => void; balance?: number | null; chat?: boolean }
const HOVER = ['Hi there.', 'Need something? Click me.', 'I’m watching your back.', 'Double-click me. Go on.', 'Ask me about prices.']
const Ori = forwardRef<OriApi, Props>(function Ori({ hidden, reduced, screen, onTap, balance = null }, ref) {
  const vw = () => innerWidth >= 1024 ? innerWidth : Math.min(innerWidth, innerWidth >= 768 ? 760 : 480), off = () => (innerWidth - vw()) / 2
  const x = useMotionValue(off() + vw() - 80), y = useMotionValue(innerHeight - 170)
  const [pose, setPose] = useState<Pose>('idle')
  const [face, setFace] = useState(1)
  const [moving, setMoving] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const busy = useRef<string | null>(null) // 'run' | 'block' | 'rest' | 'drag' | 'listen'
  const hop = useRef<HTMLDivElement>(null)
  const bTimer = useRef<number>(0)
  const [look, setLook] = useState({ x: 0, y: 0 })
  const [expr, setExprS] = useState<Expr>('none')
  const exprRef = useRef<Expr>('none'); const eTimer = useRef(0)
  const setExpr = (e: Expr, ms = 0) => { clearTimeout(eTimer.current); exprRef.current = e; setExprS(e); if (ms) eTimer.current = window.setTimeout(() => { exprRef.current = 'none'; setExprS('none') }, ms) }
  const [hover, setHover] = useState(false)
  const lastAct = useRef(Date.now()); const lastMove = useRef(Date.now())
  const tapT = useRef(0)

  const moveTo = useCallback(async (tx: number, ty: number, how: 'walk' | 'float' | 'dash' = 'walk') => {
    const minX = off() - 8, maxX = off() + vw() - S + 8
    tx = Math.max(minX - 30, Math.min(maxX + 30, tx)); ty = Math.max(6, Math.min(innerHeight - S - 4, ty))
    setFace(tx < x.get() ? -1 : 1)
    if (reduced) { x.set(tx); y.set(ty); return }
    const d = Math.hypot(tx - x.get(), ty - y.get())
    const dur = how === 'dash' ? Math.max(.35, d / 900) : Math.max(.5, d / (how === 'float' ? 160 : 120))
    setMoving(true); if (how === 'float') setPose(p => (p === 'walk' || p === 'idle' || p === 'sit' || p === 'peek') ? 'float' : p)
    else if (how === 'walk') setPose(p => (p === 'idle' || p === 'sit' || p === 'peek' || p === 'float') ? 'walk' : p)
    await Promise.all([animate(x, tx, { duration: dur, ease: 'easeInOut' }), animate(y, ty, how === 'float' ? { duration: dur, ease: [0.4, 0, 0.2, 1] } : { duration: dur, ease: 'easeInOut' })])
    setMoving(false)
  }, [reduced, x, y])

  const say = useCallback((t: string, ms = 3200) => { clearTimeout(bTimer.current); setBubble(t); bTimer.current = window.setTimeout(() => setBubble(null), Math.min(Math.max(ms, 1400), 4500)) }, [])

  // roaming brain
  useEffect(() => {
    if (reduced) return
    let alive = true
    const loop = async () => {
      await sleep(900)
      while (alive) {
        if (!busy.current) {
          const r = Math.random()
          const els = [...document.querySelectorAll<HTMLElement>('.row, .asset, .arow, section, header')].map(e => e.getBoundingClientRect()).filter(b => b.bottom > 90 && b.bottom < innerHeight - 110)
          const total = document.querySelector('.total')?.getBoundingClientRect()
          if (r < 0.22 && total && total.top > 60 && total.top < innerHeight - 200) { // sit on the balance
            await moveTo(total.left + total.width * 0.62, total.top - S + 10, 'float'); if (!busy.current) setPose('sit'); await sleep(2600)
          } else if (r < 0.5 && els.length) { // climb onto a hairline
            const b = els[Math.floor(Math.random() * els.length)]
            await moveTo(x.get(), b.bottom - S - 2, 'float'); await moveTo(rand(off() + 10, off() + vw() - S - 10), b.bottom - S - 2, 'walk'); if (!busy.current) setPose('idle'); await sleep(rand(1200, 2200))
          } else if (r < 0.68) { // peek from an edge
            const left = Math.random() < .5
            await moveTo(left ? off() - 30 : off() + vw() - S + 30, rand(140, innerHeight - 220), 'float')
            if (!busy.current) { setFace(left ? 1 : -1); setPose('peek') } await sleep(1800)
          } else { // free wander / float
            await moveTo(rand(off() + 10, off() + vw() - S - 10), rand(90, innerHeight - 190), Math.random() < .5 ? 'float' : 'walk'); if (!busy.current) setPose('idle'); await sleep(rand(900, 1800))
          }
        } else await sleep(300)
      }
    }
    loop(); return () => { alive = false }
  }, [reduced, moveTo, x, screen])

  // follow scroll: drift with the page, then settle
  useEffect(() => {
    let last = scrollY
    const f = () => { const d = scrollY - last; last = scrollY; if (busy.current || reduced) return; y.set(Math.max(6, Math.min(innerHeight - S - 4, y.get() - d * 0.6))); setPose('float') }
    addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f)
  }, [reduced, y])

  // dodge taps near him
  useEffect(() => {
    const f = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.ori')) return
      if (busy.current) return
      const cx = x.get() + S / 2, cy = y.get() + S / 2
      if (Math.hypot(e.clientX - cx, e.clientY - cy) < 70) { const dx = cx - e.clientX || 1; moveTo(x.get() + Math.sign(dx) * 90, y.get() - 30, 'dash') }
    }
    addEventListener('pointerdown', f); return () => removeEventListener('pointerdown', f)
  }, [moveTo, x, y])

  // cover eyes when balance hidden
  useEffect(() => { if (!busy.current) setPose(hidden ? 'cover' : 'idle'); if (hidden) say('Not looking.', 1600) }, [hidden, say])

  // eye follows the cursor
  useEffect(() => {
    let raf = 0
    const f = (e: PointerEvent) => { lastMove.current = lastAct.current = Date.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const dx = e.clientX - (x.get() + S / 2), dy = e.clientY - (y.get() + S / 2), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260)
      setLook({ x: dx / d * 6 * k, y: dy / d * 3.5 * k }) }) }
    const act = () => { lastAct.current = Date.now() }
    addEventListener('pointermove', f); addEventListener('keydown', act); addEventListener('scroll', act, { passive: true }); addEventListener('pointerdown', act)
    return () => { removeEventListener('pointermove', f); removeEventListener('keydown', act); removeEventListener('scroll', act); removeEventListener('pointerdown', act); cancelAnimationFrame(raf) }
  }, [x, y])
  // idle life: look around, yawn, nap, wake on activity
  useEffect(() => {
    let yawned = false
    const i = setInterval(() => {
      const idle = Date.now() - lastAct.current
      if (busy.current === 'nap') { if (idle < 1000) { busy.current = null; setExpr('happy', 1200); setPose('idle'); say('Oh! I’m up. I’m up.', 2000); if (hop.current && !reduced) animate(hop.current, { y: [0, -18, 0] }, { duration: .6 }) } return }
      if (busy.current) return
      if (idle > 45000) { busy.current = 'nap'; setPose('sit'); setExpr('sleep'); say('Taking a quick nap. Move to wake me.', 2600); return }
      if (idle > 22000 && !yawned) { yawned = true; setExpr('yawn', 1800); return }
      if (idle < 2000) yawned = false
      if (Date.now() - lastMove.current > 3500 && Math.random() < 0.18 && exprRef.current === 'none') { setLook({ x: rand(-6, 6), y: rand(-3, 3) }); setTimeout(() => setLook({ x: rand(-6, 6), y: rand(-2, 2) }), 900) }
    }, 1000)
    return () => clearInterval(i)
  }, [reduced, say])
  // peek at the balance when it changes
  const prevBal = useRef<number | null>(null)
  useEffect(() => {
    const prev = prevBal.current; prevBal.current = balance
    if (prev == null || balance == null || Math.abs(balance - prev) < 0.005 || busy.current) return
    const t = document.querySelector('.total, .money')?.getBoundingClientRect()
    busy.current = 'peekbal'
    ;(async () => { if (t && t.top > 40 && t.top < innerHeight - 120) await moveTo(t.right - 10, t.top - S + 8, 'float'); setPose('peek'); setExpr(balance > prev ? 'happy' : 'worried', 2200); await sleep(2200); if (busy.current === 'peekbal') { busy.current = null; setPose('idle') } })()
  }, [balance])
  const spin = () => { if (!hop.current) return; setExpr('happy', 1400); say(['Wheee.', 'Again?', 'Ta-da.'][Math.floor(Math.random() * 3)], 1400); if (!reduced) animate(hop.current, { rotate: [0, 360], y: [0, -34, 0] }, { duration: .8, ease: [0.3, 0, 0.2, 1] }) }
  // touch tap-through: if Ori is sitting on a control, a touch on Ori goes to that control and Ori moves aside
  const through = useRef<HTMLElement | null>(null)
  const under = (e: React.PointerEvent) => { if (e.pointerType === 'mouse') return null; const me = e.currentTarget as HTMLElement
    { const r = me.getBoundingClientRect(); if (Math.hypot(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2) < r.width * 0.3) return null } // centre of Ori = open chat
    const n = document.elementsFromPoint(e.clientX, e.clientY).find(k => !me.contains(k)) as HTMLElement | undefined
    return (n?.closest('button,a,input,select,textarea,label,[role=button],[role=tab]') as HTMLElement | null) || null }
  const passDown = (e: React.PointerEvent) => { const c = under(e); through.current = c; if (c) { e.stopPropagation(); if (/^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName)) c.focus() } }
  const passUp = (e: React.PointerEvent) => { const c = through.current; if (!c) return; e.stopPropagation(); if (!/^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName)) c.click(); else c.focus()
    setTimeout(() => { through.current = null }, 50); moveTo(rand(off() + 10, off() + vw() - S - 10), 90, 'float') }
  const tap = () => { if (through.current) return; lastAct.current = Date.now(); if (busy.current === 'nap') return; if (tapT.current) { clearTimeout(tapT.current); tapT.current = 0; spin(); return } onTap(); tapT.current = window.setTimeout(() => { tapT.current = 0 }, 260) } // open now: focus must happen inside the gesture on iOS

  useImperativeHandle(ref, () => ({
    say,
    hop: () => { if (reduced || !hop.current) return; animate(hop.current, { y: [0, -26, 0, -8, 0] }, { duration: .9, ease: 'easeOut' }) },
    listen: () => { busy.current = 'listen'; setFace(-face as 1); setPose('listen'); setTimeout(() => { if (busy.current === 'listen') busy.current = null }, 6000) },
    run: async (from: DOMRect) => {
      busy.current = 'run'
      await moveTo(from.left + from.width / 2 - S / 2, from.top - S - 4, 'dash'); setPose('carry'); await sleep(reduced ? 0 : 350)
      setFace(1); await moveTo(off() + vw() + 40, from.top - S - 70, 'dash'); await sleep(reduced ? 0 : 700)
      setFace(-1); setPose('walk'); await moveTo(from.left + from.width / 2 - S / 2, from.top - S - 4, 'dash')
      setPose('idle'); busy.current = null
    },
    block: (r: DOMRect | null) => {
      if (!r) { if (busy.current === 'block') { busy.current = null; setPose('idle') } return }
      busy.current = 'block'; moveTo(r.left + r.width / 2 - S / 2, r.top - S + 6, 'dash').then(() => setPose('block'))
      say('Stop. That address is flagged as a drainer.', 4200)
    },
    rest: (top: number | null, left?: number) => {
      if (top == null) { if (busy.current === 'rest') { busy.current = null; setPose('idle') } return }
      busy.current = 'rest'; moveTo(left ?? off() + vw() - S - 18, top - S + 4, 'float').then(() => setPose('sit'))
    },
    mood: (m) => {
      if (m === 'happy') { setExpr('happy', 2400); if (!reduced && hop.current) animate(hop.current, { y: [0, -30, 0, -10, 0], rotate: [0, -8, 8, 0] }, { duration: 1 }) }
      else if (m === 'worried') { setExpr('worried', 3600); if (!reduced && hop.current) animate(hop.current, { x: [0, -4, 4, -3, 3, 0] }, { duration: .5 }) }
      else if (m === 'think') setExpr('think', 6000)
      else setExpr('none')
    },
  }), [say, moveTo, reduced, face])

  // Bubble placement: beside Ori on the freest side, clamped to safe margins, avoiding content.
  const bRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState(false)
  useEffect(() => {
    const chk = () => setModal(!!document.querySelector(MODAL_SEL))
    chk(); const mo = new MutationObserver(chk); mo.observe(document.body, { childList: true, subtree: true }); return () => mo.disconnect()
  }, [])
  useEffect(() => { if (modal) { clearTimeout(bTimer.current); setBubble(null) } }, [modal])
  useEffect(() => {
    if (!bubble) return
    let raf = 0, last = ''
    const place = () => {
      const el = bRef.current
      if (el) {
        const w = el.offsetWidth, h = el.offsetHeight, ox = x.get(), oy = y.get(), M = 12, G = 10
        const L = off() + M, R = off() + vw() - M, T = M + (innerWidth < 1024 ? 0 : 0), B = innerHeight - M - (innerWidth < 1024 ? 72 : 0)
        const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
        const cands = [
          { k: 'r', l: ox + S + G, t: oy + S / 2 - h / 2 }, { k: 'l', l: ox - G - w, t: oy + S / 2 - h / 2 },
          { k: 't', l: ox + S / 2 - w / 2, t: oy - G - h }, { k: 'b', l: ox + S / 2 - w / 2, t: oy + S + G },
        ]
        const obs = Array.from(document.querySelectorAll<HTMLElement>(AVOID_SEL)).map(e => e.getBoundingClientRect()).filter(r => r.width && r.height && r.width < innerWidth * .98)
        let best = cands[0], bs = Infinity
        for (const c of cands) {
          const fit = (c.l < L || c.l + w > R || c.t < T || c.t + h > B) ? 1 : 0
          const l = cl(c.l, L, R - w), t = cl(c.t, T, B - h)
          // penalise overlap with content and with Ori himself
          let sc = fit * 5e4
          for (const r of obs) sc += Math.max(0, Math.min(l + w, r.right + 6) - Math.max(l, r.left - 6)) * Math.max(0, Math.min(t + h, r.bottom + 6) - Math.max(t, r.top - 6))
          sc += 40 * Math.max(0, Math.min(l + w, ox + S) - Math.max(l, ox)) * Math.max(0, Math.min(t + h, oy + S) - Math.max(t, oy))
          if (sc < bs) { bs = sc; best = { ...c, l, t } }
        }
        const key = `${Math.round(best.l)},${Math.round(best.t)}`
        if (key !== last) { last = key; el.style.transform = `translate(${best.l}px,${best.t}px)`; el.dataset.side = best.k }
      }
      raf = requestAnimationFrame(place)
    }
    raf = requestAnimationFrame(place); return () => cancelAnimationFrame(raf)
  }, [bubble, x, y])
  return <>
    <motion.div className="ori" style={{ x, y }} drag dragMomentum={false} onPointerDownCapture={passDown} onPointerUpCapture={passUp}
      onDragStart={() => { busy.current = 'drag'; setPose('float') }}
      onDragEnd={() => { busy.current = null; setPose('idle') }}
      onTap={tap} onHoverStart={() => { setHover(true); if (!busy.current && !bubble && Math.random() < 0.6) say(HOVER[Math.floor(Math.random() * HOVER.length)], 1800) }} onHoverEnd={() => setHover(false)}
      whileHover={reduced ? undefined : { scale: 1.08 }} aria-label="Ori, your ORI agent. Click to talk, double-click to spin." role="button">
      <div ref={hop}><motion.div animate={reduced || moving ? {} : { y: pose === 'float' ? [0, -4, 0] : [0, -1.5, 0] }} transition={{ repeat: Infinity, duration: pose === 'float' ? 1.8 : 2.6 }}>
        <OriSprite pose={pose} face={face} moving={moving && pose !== 'float'} look={look} expr={expr} big={hover} /></motion.div></div>
    </motion.div>
    <AnimatePresence>{bubble && !modal && <motion.div key="b" className="bubble-wrap" ref={bRef} style={{ transform: `translate(${x.get()}px,${y.get() - 70}px)` }}><motion.div className="bubble" role="status" aria-live="polite" initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}>
      <span className="mono xs dim">ORI</span>{bubble}</motion.div></motion.div>}</AnimatePresence>
  </>
})
export default Ori
