import { useEffect, useRef } from 'react'
// Flowing particle-dust hourglass / wave. Mint #7DF5D8 glow (particles only).
export default function Dust({ height = 300, full = false, reduce: rp = false }: { height?: number; full?: boolean; reduce?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!
    const dpr = Math.min(devicePixelRatio || 1, 2)
    let W = 0, H = full ? innerHeight : height
    const N = full ? 4200 : 2600
    const P = Array.from({ length: N }, () => ({ u: Math.random(), v: Math.random() * 2 - 1, s: Math.random(), r: Math.random() }))
    const reduce = rp || matchMedia('(prefers-reduced-motion: reduce)').matches
    let t = 0, raf = 0, last = performance.now()
    const draw = (now = performance.now()) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now
      if (!reduce) t += dt * 0.22 // slow-motion continuous drift, frame-rate independent
      if (c.clientWidth !== W || (full && innerHeight !== H)) { W = c.clientWidth; if (full) H = innerHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
      ctx.clearRect(0, 0, W, H)
      for (const p of P) {
        const y = (p.u * H + t * 40 * (p.s + 0.25)) % H
        const k = (y - H / 2) / (H / 2)            // -1..1
        const waist = (full ? 0.2 : 0.06) + (full ? 0.8 : 0.9) * Math.pow(Math.abs(k), 1.6) // hourglass
        const wave = Math.sin(k * 3 + t * 2 + p.s * 0.6) * 18
        const x = (full ? W / 2 + 124 : W / 2) + p.v * waist * W * (full ? 0.5 : 0.42) + wave * (full ? 2 : 1) + Math.sin(t * 1.6 + p.r * 9) * 6 + Math.cos(t * 0.9 + p.s * 7) * 4
        const yy = y
        const edge = Math.abs(p.v)
        const a = (full ? 0.4 : 0.18) + 0.8 * Math.pow(edge, 3) * (0.4 + p.r)
        ctx.fillStyle = `rgba(125,245,216,${Math.min(a, 0.9)})`
        const sz = p.r > 0.97 ? 1.6 : full ? 1.1 : 0.8
        ctx.shadowBlur = p.r > 0.9 ? 6 : 0; ctx.shadowColor = 'rgba(125,245,216,0.8)'
        ctx.fillRect(x, yy, sz, sz)
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    draw(); return () => cancelAnimationFrame(raf)
  }, [height, full, rp])
  return <canvas ref={ref} className={'dust' + (full ? ' bgdust' : '')} style={full ? undefined : { height }} aria-hidden />
}
