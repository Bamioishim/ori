import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'motion/react'

export type Pose = 'idle' | 'walk' | 'float' | 'listen' | 'carry' | 'cover' | 'block' | 'sit' | 'peek'
export type OriApi = {
  say: (t: string, ms?: number) => void
  hop: () => void
  listen: () => void
  run: (from: DOMRect) => Promise<void>
  block: (r: DOMRect | null) => void
  rest: (bottomY: number | null) => void
}
const S = 56 // rendered size
const M = '#7DF5D8', W = '#F2F1EC'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const rand = (a: number, b: number) => a + Math.random() * (b - a)

// Ori sprite: orb bot (concept 2) + Courier's cross-body bag & speed lines
export function OriSprite({ pose, face = 1, moving = false }: { pose: Pose; face?: number; moving?: boolean }) {
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
  const eyeX = pose === 'listen' ? 66 : pose === 'peek' ? 70 : 60
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
    {pose === 'idle' || pose === 'sit'
      ? <><circle cx={eyeX} cy="59" r="6" fill={M} filter="url(#ori-gl)" className="blink" /></>
      : pose === 'block'
        ? <path d="M54 54 l12 10 M66 54 l-12 10" stroke={M} strokeWidth="3.2" strokeLinecap="round" filter="url(#ori-gl)" />
        : <><circle cx={eyeX} cy="59" r={pose === 'listen' ? 7 : 6} fill={M} filter="url(#ori-gl)" /><circle cx={eyeX + 2} cy="57" r="1.8" fill="#fff" /></>}
    {/* courier cross-body bag */}
    <path d="M38 40 Q62 74 84 84" stroke="#4a4a4a" strokeWidth="3" fill="none" />
    <rect x="76" y="78" width="20" height="15" rx="3" fill="#2e2e2e" stroke={W} strokeWidth="1.4" />
    <path d="M76 84 h20" stroke={W} strokeWidth="1" opacity=".5" />
    {arms}
    {pose === 'carry' && <g filter="url(#ori-gl)"><circle cx="60" cy="16" r="13" fill="#0B0B0B" stroke={M} strokeWidth="2.6" /><circle cx="60" cy="16" r="5.5" fill={M} /></g>}
  </svg>
}

type Props = { hidden: boolean; reduced: boolean; screen: string; onTap: () => void }
const Ori = forwardRef<OriApi, Props>(function Ori({ hidden, reduced, screen, onTap }, ref) {
  const vw = () => Math.min(innerWidth, 480), off = () => (innerWidth - vw()) / 2
  const x = useMotionValue(off() + vw() - 80), y = useMotionValue(innerHeight - 170)
  const [pose, setPose] = useState<Pose>('idle')
  const [face, setFace] = useState(1)
  const [moving, setMoving] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const busy = useRef<string | null>(null) // 'run' | 'block' | 'rest' | 'drag' | 'listen'
  const hop = useRef<HTMLDivElement>(null)
  const bTimer = useRef<number>(0)

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

  const say = useCallback((t: string, ms = 3200) => { clearTimeout(bTimer.current); setBubble(t); bTimer.current = window.setTimeout(() => setBubble(null), ms) }, [])

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
    rest: (top: number | null) => {
      if (top == null) { if (busy.current === 'rest') { busy.current = null; setPose('idle') } return }
      busy.current = 'rest'; moveTo(off() + vw() - S - 18, top - S + 4, 'float').then(() => setPose('sit'))
    },
  }), [say, moveTo, reduced, face])

  const bx = useTransform(x, v => Math.max(off() + 8, Math.min(off() + vw() - 228, v - 84)))
  const by = useTransform(y, v => v < 140 ? v + S + 10 : v - 62)
  return <>
    <motion.div className="ori" style={{ x, y }} drag dragMomentum={false}
      onDragStart={() => { busy.current = 'drag'; setPose('float') }}
      onDragEnd={() => { busy.current = null; setPose('idle') }}
      onTap={onTap} aria-label="Ori, your Meridian agent. Tap to talk." role="button">
      <div ref={hop}><motion.div animate={reduced || moving ? {} : { y: pose === 'float' ? [0, -4, 0] : [0, -1.5, 0] }} transition={{ repeat: Infinity, duration: pose === 'float' ? 1.8 : 2.6 }}>
        <OriSprite pose={pose} face={face} moving={moving && pose !== 'float'} /></motion.div></div>
    </motion.div>
    <AnimatePresence>{bubble && <motion.div className="bubble" style={{ x: bx, y: by }} initial={{ opacity: 0, scale: .92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .95 }}>
      <span className="mono xs dim">ORI</span>{bubble}</motion.div>}</AnimatePresence>
  </>
})
export default Ori
