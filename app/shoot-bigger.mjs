import { chromium, devices } from '@playwright/test'
const U = process.argv[2] || 'http://localhost:4317', tag = process.argv[3] || 'bigger'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const fps = p => p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 3000 ? requestAnimationFrame(f) : r((n / 3).toFixed(1)) }; requestAnimationFrame(f) }))
for (const [k, o] of [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }]]) for (const s of ['orb', 'galaxy', 'brain']) {
  const c = await b.newContext(o); const p = await c.newPage(); await p.goto(`${U}/?intro=0&nebula=${s}`); await p.waitForTimeout(6500)
  if (k === 'desk') { for (let i = 0; i < 25; i++) await p.mouse.move(500 + i * 18, 300 + Math.sin(i / 3) * 120); }
  await p.waitForTimeout(120); await p.screenshot({ path: `/workspace/meridian/shots/${tag}-${s}-${k}.png` })
  if (s === 'orb') console.log(k, 'fps', await fps(p), 'N', await p.evaluate(() => window.__nebN?.()))
  await c.close()
}
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: '/tmp/bigvid', size: { width: 960, height: 600 } } })
const p = await c.newPage(); await p.goto(`${U}/?intro=0`); await p.waitForTimeout(6000)
for (let i = 0; i < 60; i++) await p.mouse.move(720 + Math.cos(i / 6) * 300, 430 + Math.sin(i / 6) * 200, { steps: 2 })
await p.mouse.click(720, 430); await p.waitForTimeout(900)
await p.mouse.down(); for (let i = 0; i < 40; i++) await p.mouse.move(400 + i * 16, 600 - i * 8, { steps: 2 }); await p.mouse.up()
await p.evaluate(() => window.__neb('galaxy')); for (let i = 0; i < 30; i++) await p.mouse.move(300 + i * 25, 450, { steps: 2 })
await p.waitForTimeout(800); await p.evaluate(() => window.__neb('orb')); await p.mouse.click(900, 380); await p.waitForTimeout(1500)
console.log('video', await p.video().path()); await c.close(); await b.close()
