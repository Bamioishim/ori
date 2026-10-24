import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const U = 'https://ori-preview.vercel.app/?intro=0'
for (const [k, o] of [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }]]) {
  const c = await b.newContext(o); const p = await c.newPage(); await p.goto(U + '&nebula=brain'); await p.waitForTimeout(7500)
  await p.screenshot({ path: `/workspace/meridian/shots/shipped-brain-${k}.png` })
  console.log(k, 'canvas', await p.evaluate(() => getComputedStyle(document.querySelector('.nebula')).opacity))
  await c.close()
}
// pause check: off Home + hidden
const c0 = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p0 = await c0.newPage(); await p0.goto(U); await p0.waitForTimeout(6500)
await p0.getByText('Settings').first().click(); await p0.waitForTimeout(1500)
console.log('settings opacity', await p0.evaluate(() => getComputedStyle(document.querySelector('.nebula')).opacity)); await c0.close()
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: '/tmp/shipvid', size: { width: 960, height: 600 } } })
const p = await c.newPage(); await p.goto(U); await p.waitForTimeout(6000)
for (const [st, ms] of [['galaxy', 2500], ['brain', 3500], ['orb', 3000]]) { await p.evaluate(s => window.__neb?.(s), st); await p.mouse.move(700 + Math.random() * 300, 400, { steps: 20 }); await p.waitForTimeout(ms) }
console.log('video', await p.video().path()); await c.close(); await b.close()
