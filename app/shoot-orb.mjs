import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const vps = { desk: { viewport: { width: 1440, height: 900 } }, mob: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } }
for (const [k, o] of Object.entries(vps)) for (const s of ['orb', 'galaxy', 'brain']) {
  const c = await b.newContext(o); const p = await c.newPage(); await p.goto(`http://localhost:4317/?intro=0&nebula=${s}`); await p.waitForTimeout(6000)
  if (k === 'desk') await p.mouse.move(900, 380)
  await p.waitForTimeout(1500); await p.screenshot({ path: `/workspace/meridian/shots/concept-${s}-${k}.png` })
  if (s === 'orb') { const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r(n / 2) }; requestAnimationFrame(f) })); console.log(k, 'fps', fps) }
  await c.close()
}
// transition video (desktop): orb → galaxy → brain → orb
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: '/tmp/orbvid', size: { width: 960, height: 600 } } })
const p = await c.newPage(); await p.goto('http://localhost:4317/?intro=0'); await p.waitForTimeout(6000)
const mod = '/src/Nebula.tsx'
await p.evaluate(() => window.dispatchEvent(new Event('x')))
for (const [st, ms] of [['galaxy', 2500], ['brain', 3500], ['orb', 3000]]) { await p.evaluate(s => window.__neb?.(s), st); await p.mouse.move(700 + Math.random() * 300, 400, { steps: 20 }); await p.waitForTimeout(ms) }
const v = await p.video().path(); await c.close(); console.log('video', v)
await b.close()
