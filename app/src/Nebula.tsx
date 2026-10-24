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
      return { orb, gal, br, x: orb[0], y: orb[1], z: orb[2], vx: 0, vy: 0, vz: 0, sz: rnd() < .04 ? 2 : rnd() < .4 ? 1.3 : 0.9, ph: rnd() * 6.28, violet, ox: 0, oy: 0, ovx: 0, ovy: 0, n1: rnd() * 100 }
    })
    let W = 0, H = 0, raf = 0, frames = 0, slowT = 0, running = false, last = performance.now(), t = 0, state = cur
    // pointer (screen space) with velocity; eased "follow" target for the shape centre
    const ptr = { x: -9999, y: -9999, vx: 0, vy: 0, on: false, down: false }
    const fol = { x: 0, y: 0, vx: 0, vy: 0 } // eased follow offset (px)
    const tilt = { x: 0, y: 0, gx: 0, gy: 0 }
    let scrollV = 0, lastScroll = scrollY
    const rip: { x: number; y: number; t: number }[] = []
    const mv = (e: PointerEvent) => { if (ptr.on) { ptr.vx = ptr.vx * 0.5 + (e.clientX - ptr.x) * 0.5; ptr.vy = ptr.vy * 0.5 + (e.clientY - ptr.y) * 0.5 } ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true }
    let askedGyro = false
    const dn = (e: PointerEvent) => {
      mv(e); ptr.down = true; rip.push({ x: e.clientX, y: e.clientY, t: 0 }); if (rip.length > 4) rip.shift()
    }
    const up = (e: PointerEvent) => {
      // iOS motion permission: only from a tap on empty background, never on Ori/buttons/inputs (the prompt would swallow the tap)
      const D: any = (window as any).DeviceOrientationEvent, el = e.target as Element | null
      if (!askedGyro && D && typeof D.requestPermission === 'function' && el && !el.closest('button,a,input,textarea,form,.ori,.chat,[role=button]')) { askedGyro = true; D.requestPermission().catch(() => {}) } ptr.down = false; if (matchMedia('(pointer: coarse)').matches) ptr.on = false }
    const lv = () => { ptr.on = false }
    const sc = () => { const d = scrollY - lastScroll; lastScroll = scrollY; scrollV += d * 0.6 }
    const ori = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; tilt.gx = Math.max(-1, Math.min(1, e.gamma / 35)); tilt.gy = Math.max(-1, Math.min(1, (e.beta - 45) / 35)) }
    addEventListener('pointermove', mv, { passive: true }); addEventListener('pointerdown', dn, { passive: true }); addEventListener('pointerup', up); addEventListener('pointercancel', up)
    document.addEventListener('pointerleave', lv); addEventListener('scroll', sc, { passive: true }); addEventListener('deviceorientation', ori)
    const sub = (s: NebulaState) => { if (s !== state) { setTimeout(() => wake(), 0); state = s; if (s === 'galaxy') for (const p of P) { p.vx += p.x * 0.5; p.vz += p.z * 0.5 } } }
    subs.add(sub)
    // batched draw: 2 colours × 4 alpha buckets, one fill each
    const AL = [0.18, 0.36, 0.6, 0.9]
    const paths: Path2D[] = new Array(8)
    const draw = (now = performance.now()) => {
      const dt = Math.min((now - last) / 1000, 0.033); last = now
      if (!reduce) t += dt
      const r = c.getBoundingClientRect()
      if (r.width !== W || r.height !== H) { W = r.width; H = r.height; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
      ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H)
      const short = Math.min(W, H)
      const R = short * (mob ? 0.39 : 0.4) // orb diameter ≈ 78-80% of short side
      const bx = W * (mob ? 0.5 : 0.5), by = H * (mob ? 0.42 : 0.47)
      // eased spring follow toward pointer (lagged), plus scroll nudge
      const tx = ptr.on ? (ptr.x - r.left - bx) * 0.22 : 0, ty = ptr.on ? (ptr.y - r.top - by) * 0.22 : 0
      fol.vx += ((tx - fol.x) * 7 - fol.vx * 5) * dt; fol.vy += ((ty - fol.y) * 7 - fol.vy * 5) * dt - scrollV * 0.9 * dt * 10
      fol.x += fol.vx * dt; fol.y += fol.vy * dt; scrollV *= Math.pow(0.02, dt)
      const cx = bx + fol.x, cy = by + fol.y
      tilt.x += ((ptr.on ? (ptr.x - r.left - bx) / W : tilt.gx * 0.6) - tilt.x) * (1 - Math.pow(0.15, dt))
      tilt.y += ((ptr.on ? (ptr.y - r.top - by) / H : tilt.gy * 0.6) - tilt.y) * (1 - Math.pow(0.15, dt))
      const breathe = 1 + Math.sin(t * 1.1) * 0.06
      const rotY = (state === 'galaxy' ? t * 0.22 : state === 'brain' ? Math.sin(t * 0.35) * 0.5 : t * 0.1) + tilt.x * 1.2
      const tl = (state === 'galaxy' ? 1.0 : 0.15) + tilt.y * 0.9
      const gScale = state === 'galaxy' ? 1.35 : 1 // galaxy spills past the edges
      const cY = Math.cos(rotY), sY = Math.sin(rotY), cX = Math.cos(tl), sX = Math.sin(tl)
      // critically-damped spring toward each state's shape (smooth, no overshoot jitter)
      const k = state === 'galaxy' ? 9 : 12, cd = 2 * Math.sqrt(k) * 0.9
      const wave = (t * 1.4) % 3 - 1.5
      const prx = ptr.x - r.left, pry = ptr.y - r.top
      const pv = Math.min(Math.hypot(ptr.vx, ptr.vy), 80)
      const wakeR = (mob ? 150 : 220), wr2 = wakeR * wakeR
      for (const g of rip) g.t += dt
      while (rip.length && rip[0].t > 1.6) rip.shift()
      ptr.vx *= Math.pow(0.05, dt); ptr.vy *= Math.pow(0.05, dt)
      for (let i = 0; i < 8; i++) paths[i] = new Path2D()
      const fdt = Math.min(dt, 0.02)
      for (const p of P) {
        const tg = state === 'orb' ? p.orb : state === 'galaxy' ? p.gal : p.br
        let gx = tg[0] * gScale, gy = tg[1] * gScale, gz = tg[2] * gScale
        if (state === 'orb') { const b = breathe + Math.sin(t * 1.6 + p.ph) * 0.015; gx *= b; gy *= b; gz *= b }
        if (state === 'galaxy') { const d = Math.hypot(gx, gz), sp = t * (0.45 / (0.5 + d)), cs = Math.cos(sp), sn = Math.sin(sp); const nx = gx * cs - gz * sn; gz = gx * sn + gz * cs; gx = nx }
        // smooth flow-field drift (divergence-free-ish curl of two sine fields)
        const q = t * 0.25 + p.n1
        gx += Math.sin(gy * 2.1 + q) * 0.035; gy += Math.sin(gz * 2.3 + q * 1.1) * 0.035; gz += Math.sin(gx * 1.9 + q * 0.9) * 0.035
        p.vx += ((gx - p.x) * k - p.vx * cd) * fdt; p.vy += ((gy - p.y) * k - p.vy * cd) * fdt; p.vz += ((gz - p.z) * k - p.vz * cd) * fdt
        p.x += p.vx * fdt; p.y += p.vy * fdt; p.z += p.vz * fdt
        const x1 = p.x * cY - p.z * sY, z1 = p.x * sY + p.z * cY
        const y2 = p.y * cX - z1 * sX, z2 = p.y * sX + z1 * cX
        const persp = 2.8 / (2.8 + z2)
        const sx0 = cx + x1 * R * persp, sy0 = cy + y2 * R * persp
        // 2D fluid layer: swirl + stir around the pointer, ripples, spring back with damping
        let fx = 0, fy = 0
        const sx = sx0 + p.ox, sy = sy0 + p.oy
        if (ptr.on) {
          const dx = sx - prx, dy = sy - pry, d2 = dx * dx + dy * dy
          if (d2 < wr2) {
            const d = Math.sqrt(d2) + 1, f = 1 - d2 / wr2
            fx += (-dy / d) * f * 900 + (dx / d) * f * 500 + ptr.vx * f * (ptr.down ? 90 : 45)
            fy += (dx / d) * f * 900 + (dy / d) * f * 500 + ptr.vy * f * (ptr.down ? 90 : 45)
          }
        }
        for (const g of rip) { const dx = sx - g.x + r.left, dy = sy - g.y + r.top, d = Math.hypot(dx, dy) + 1, ring = g.t * 700, w = Math.exp(-Math.pow((d - ring) / 40, 2)) * (1 - g.t / 1.6); if (w > 0.01) { fx += dx / d * w * 6000; fy += dy / d * w * 6000 } }
        p.ovx += (fx - p.ox * 6 - p.ovx * 3.2) * fdt; p.ovy += (fy - p.oy * 6 - p.ovy * 3.2) * fdt
        p.ox += p.ovx * fdt; p.oy += p.ovy * fdt
        let a = (0.22 + 0.4 * persp * persp) * dim
        if (state === 'brain') { a += Math.exp(-Math.pow((p.z - wave) * 3, 2)) * 0.5 * dim; if (p.sz > 1.5 && Math.sin(t * 5 + p.ph * 3) > 0.93) a += 0.5 }
        if (state === 'orb') a *= 0.88 + Math.sin(t * 1.1) * 0.12
        a += Math.min(Math.hypot(p.ovx, p.ovy) / 900, 0.5) // wake glows
        if (sx < -4 || sy < -4 || sx > W + 4 || sy > H + 4) continue
        const bi = a < 0.27 ? 0 : a < 0.48 ? 1 : a < 0.75 ? 2 : 3
        const s = p.sz * persp * (mob ? 1.15 : 1.25)
        paths[(p.violet ? 4 : 0) + bi].rect(sx, sy, s, s)
      }
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i < 4 ? `rgba(125,245,216,${AL[i]})` : `rgba(169,155,214,${AL[i - 4] * 0.85})`; ctx.fill(paths[i]) }
      const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5)
      const ga = (state === 'orb' ? 0.09 * breathe : state === 'brain' ? 0.07 : 0.045) * dim
      gl.addColorStop(0, `rgba(125,245,216,${ga})`); gl.addColorStop(0.5, `rgba(150,130,210,${ga * 0.5})`); gl.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H)
      void pv
      if (frames < 90) { frames++; slowT += dt; if (frames === 90 && slowT / 90 > 0.022 && P.length > 600) { P.length = Math.floor(P.length * 0.55); N = P.length } }
      if (visible()) raf = requestAnimationFrame(draw); else { running = false; c.style.opacity = '0' }
    }
    const visible = () => !document.hidden && (act.current || state !== 'orb')
    const wake = () => { if (!running && visible()) { running = true; c.style.opacity = ''; last = performance.now(); raf = requestAnimationFrame(draw) } else if (!visible()) c.style.opacity = '0' }
    kick.current = wake
    const vis = () => wake(); document.addEventListener('visibilitychange', vis)
    ;(window as any).__nebN = () => N
    wake()
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); subs.delete(sub); removeEventListener('pointermove', mv); removeEventListener('pointerdown', dn); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); document.removeEventListener('pointerleave', lv); removeEventListener('scroll', sc); removeEventListener('deviceorientation', ori) }
  }, [rp, dim])
  return <canvas ref={ref} className="nebula" aria-hidden />
}
