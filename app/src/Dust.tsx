import { useEffect, useRef } from 'react'
// Flowing particle-dust hourglass / wave. Mint #7DF5D8 glow (particles only).
export default function Dust({ height = 300 }: { height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!; const ctx = c.getContext('2d')!
    const dpr = Math.min(devicePixelRatio || 1, 2)
    let W = 0; const H = height
    const N = 2600
    const P = Array.from({ length: N }, () => ({ u: Math.random(), v: Math.random() * 2 - 1, s: Math.random(), r: Math.random() }))
    let t = 0, raf = 0
    const draw = () => {
      t += 0.004
      if (c.clientWidth !== W) { W = c.clientWidth; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
      ctx.clearRect(0, 0, W, H)
      for (const p of P) {
        const y = (p.u * H + t * 22 * (p.s + 0.2) * 3) % H
        const k = (y - H / 2) / (H / 2)            // -1..1
        const waist = 0.06 + 0.9 * Math.pow(Math.abs(k), 1.6) // hourglass
        const wave = Math.sin(k * 3 + t * 2 + p.s * 0.6) * 18
        const x = W / 2 + p.v * waist * W * 0.42 + wave + Math.sin(t * 3 + p.r * 9) * 2
        const yy = y
        const edge = Math.abs(p.v)
        const a = 0.18 + 0.8 * Math.pow(edge, 3) * (0.4 + p.r)
        ctx.fillStyle = `rgba(125,245,216,${Math.min(a, 0.9)})`
        const sz = p.r > 0.97 ? 1.6 : 0.8
        ctx.shadowBlur = p.r > 0.9 ? 6 : 0; ctx.shadowColor = 'rgba(125,245,216,0.8)'
        ctx.fillRect(x, yy, sz, sz)
      }
      raf = requestAnimationFrame(draw)
    }
    draw(); return () => cancelAnimationFrame(raf)
  }, [height])
  return <canvas ref={ref} className="dust" style={{ height }} aria-hidden />
}
