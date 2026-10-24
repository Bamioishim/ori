import { useEffect, useRef } from 'react'
// Concept: mint/violet particle cloud — breathing orb → spiral galaxy → thinking brain.
export type NebulaState = 'orb' | 'galaxy' | 'brain'
let cur: NebulaState = 'orb'
const subs = new Set<(s: NebulaState) => void>()
export const setNebula = (s: NebulaState) => { cur = s; subs.forEach(f => f(s)) }
;(window as any).__neb = setNebula
// "start an action / speak" → burst to galaxy, then gather into a brain while processing
let tm = 0, safety = 0
export const nebulaThink = () => { clearTimeout(tm); clearTimeout(safety); safety = window.setTimeout(() => setNebula('orb'), 9000); setNebula('galaxy'); tm = window.setTimeout(() => cur === 'galaxy' && setNebula('brain'), 900) }
export const nebulaDone = (delay = 1200) => { clearTimeout(tm); tm = window.setTimeout(() => setNebula('orb'), delay) }

export default function Nebula({ reduce: rp = false, dim = 1, active = true }: { reduce?: boolean; dim?: number; active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const act = useRef(active); act.current = active
  const kick = useRef<() => void>(() => {})
  useEffect(() => { kick.current() }, [active])
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!
    const dpr = Math.min(devicePixelRatio || 1, 1.5)
    const mob = innerWidth < 760
    const nav: any = navigator
    const low = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 3
    let N = mob ? (low ? 900 : 1800) : (low ? 1800 : 3200)
    const reduce = rp || matchMedia('(prefers-reduced-motion: reduce)').matches
    const forced = new URLSearchParams(location.search).get('nebula') as NebulaState | null
    if (forced) cur = forced
    const rnd = Math.random
    const P = Array.from({ length: N }, (_, i) => {
      // orb: point in sphere, denser core
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr = Math.pow(rnd(), 0.6)
      const s = Math.sqrt(1 - u * u)
      const orb = [s * Math.cos(th) * rr, u * rr, s * Math.sin(th) * rr]
      // galaxy: 3 log-spiral arms in a tilted disk + bulge
      const arm = i % 3, d = Math.pow(rnd(), 0.8) * 2.1, a = arm * 2.094 + d * 2.6 + (rnd() - .5) * (0.5 + d * 0.18)
      const gal = i % 9 === 0 ? [orb[0] * .35, orb[1] * .2, orb[2] * .35] : [Math.cos(a) * d, (rnd() - .5) * 0.09 * (2.2 - d), Math.sin(a) * d]
      // brain: two folded hemispheres + stem
      let br: number[]
      if (i % 40 === 0) br = [(rnd() - .5) * .18, -0.75 - rnd() * .45, -0.15 + (rnd() - .5) * .18]
      else {
        const side = i % 2 ? 1 : -1, bu = rnd() * 2 - 1, bt = rnd() * Math.PI * 2, bs = Math.sqrt(1 - bu * bu)
        let x = bs * Math.cos(bt), y = bu, z = bs * Math.sin(bt)
        const fold = 1 + 0.09 * Math.sin(y * 13 + z * 7) * Math.sin(z * 11 - x * 5)
        const inner = rnd() < .15 ? 0.6 + rnd() * .35 : 1
        x = Math.abs(x) * 0.62 * side; br = [(x + side * 0.08) * fold * inner, y * 0.78 * fold * inner - (y < -0.5 ? 0.1 : 0), z * 1.05 * fold * inner]
      }
      const violet = rnd() < 0.27
      return { orb, gal, br, x: orb[0], y: orb[1], z: orb[2], vx: 0, vy: 0, vz: 0, sz: rnd() < .04 ? 2 : rnd() < .4 ? 1.3 : 0.9, ph: rnd() * 6.28, violet, sx: 0, sy: 0 }
    })
    let W = 0, H = 0, raf = 0, frames = 0, slowT = 0, running = false, last = performance.now(), t = 0, state = cur, since = 0
    const ptr = { x: -9999, y: -9999, tx: 0, ty: 0, on: false }
    const mv = (e: PointerEvent) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true }
    const lv = () => { ptr.on = false }
    addEventListener('pointermove', mv); addEventListener('pointerdown', mv); document.addEventListener('pointerleave', lv)
    const sub = (s: NebulaState) => { if (s !== state) { setTimeout(() => wake(), 0); state = s; since = 0; if (s === 'galaxy') for (const p of P) { const k = 0.06; p.vx += p.x * k * 3; p.vz += p.z * k * 3; p.vy += (rnd() - .5) * k } } }
    subs.add(sub)
    const draw = (now = performance.now()) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now
      if (!reduce) { t += dt; since += dt }
      const r = c.getBoundingClientRect()
      if (r.width !== W || r.height !== H) { W = r.width; H = r.height; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
      ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'
      const cx = W * (mob ? 0.5 : 0.42), cy = H * (mob ? 0.36 : 0.3), R = Math.min(W, H) * (mob ? 0.27 : 0.24)
      // cursor parallax tilt
      const lx = ptr.on ? (ptr.x - r.left - cx) / W : 0, ly = ptr.on ? (ptr.y - r.top - cy) / H : 0
      ptr.tx += (lx - ptr.tx) * 0.05; ptr.ty += (ly - ptr.ty) * 0.05
      const breathe = 1 + Math.sin(t * 1.3) * 0.07
      const rotY = state === 'galaxy' ? t * 0.35 : state === 'brain' ? Math.sin(t * 0.4) * 0.6 + ptr.tx * 1.4 : t * 0.15
      const tilt = (state === 'galaxy' ? 1.05 : 0.15) + ptr.ty * 0.8
      const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(tilt), sX = Math.sin(tilt)
      const spring = state === 'galaxy' ? 2.4 : 3.2, damp = Math.pow(0.04, dt)
      const wave = (t * 1.6) % 3 - 1.5 // brain "thought" pulse travelling front-to-back
      const prx = ptr.x - r.left, pry = ptr.y - r.top
      for (const p of P) {
        let tg = state === 'orb' ? p.orb : state === 'galaxy' ? p.gal : p.br
        let tx = tg[0], ty = tg[1], tz = tg[2]
        if (state === 'orb') { const b = breathe + Math.sin(t * 2 + p.ph) * 0.02; tx *= b; ty *= b; tz *= b }
        if (state === 'galaxy') { const d = Math.hypot(tx, tz), sp = t * (0.6 / (0.4 + d)), cs = Math.cos(sp), sn = Math.sin(sp); const nx = tx * cs - tz * sn; tz = tx * sn + tz * cs; tx = nx }
        p.vx += (tx - p.x) * spring * dt; p.vy += (ty - p.y) * spring * dt; p.vz += (tz - p.z) * spring * dt
        p.vx *= damp; p.vy *= damp; p.vz *= damp
        p.x += p.vx * dt * 4; p.y += p.vy * dt * 4; p.z += p.vz * dt * 4
        // rotate + project
        const x1 = p.x * cY - p.z * sY, z1 = p.x * sY + p.z * cY
        const y2 = p.y * cX - z1 * sX, z2 = p.y * sX + z1 * cX
        const persp = 2.6 / (2.6 + z2)
        let sx = cx + x1 * R * persp, sy = cy + y2 * R * persp
        // cursor / touch: particles part around the pointer
        if (ptr.on) { const dx = sx - prx, dy = sy - pry, d2 = dx * dx + dy * dy, rad = 110 * 110; if (d2 < rad) { const f = (1 - d2 / rad) * 34 / Math.sqrt(d2 + 1); sx += dx * f; sy += dy * f } }
        let a = (0.25 + 0.55 * persp * persp * 0.6) * dim
        if (state === 'brain') { const hit = Math.exp(-Math.pow((p.z - wave) * 3, 2)); a += hit * 0.55 * dim; if (p.sz > 1.5) a += (Math.sin(t * 6 + p.ph * 3) > 0.92 ? 0.6 : 0) }
        if (state === 'orb') a *= 0.85 + Math.sin(t * 1.3) * 0.15
        ctx.fillStyle = p.violet ? `rgba(169,155,214,${Math.min(a * 0.85, 1)})` : `rgba(125,245,216,${Math.min(a, 1)})`
        const s = p.sz * persp
        ctx.fillRect(sx, sy, s, s)
      }
      // soft core glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.4)
      const ga = (state === 'orb' ? 0.10 * breathe : state === 'brain' ? 0.08 : 0.05) * dim
      g.addColorStop(0, `rgba(125,245,216,${ga})`); g.addColorStop(0.5, `rgba(150,130,210,${ga * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      // FPS check: first ~90 frames; if averaging under ~40fps, halve particles once
      if (frames < 90) { frames++; slowT += dt; if (frames === 90 && slowT / 90 > 0.025 && P.length > 600) { P.length = Math.floor(P.length / 2); N = P.length } }
      if (visible()) raf = requestAnimationFrame(draw); else { running = false; c.style.opacity = '0' }
    }
    const visible = () => !document.hidden && (act.current || state !== 'orb')
    const wake = () => { if (!running && visible()) { running = true; c.style.opacity = ''; last = performance.now(); raf = requestAnimationFrame(draw) } else if (!visible()) c.style.opacity = '0' }
    kick.current = wake
    const vis = () => wake(); document.addEventListener('visibilitychange', vis)
    wake()
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); subs.delete(sub); removeEventListener('pointermove', mv); removeEventListener('pointerdown', mv); document.removeEventListener('pointerleave', lv) }
  }, [rp, dim])
  return <canvas ref={ref} className="nebula" aria-hidden />
}
