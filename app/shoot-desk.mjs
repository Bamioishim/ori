import { chromium, devices } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:4317', pre = process.argv[3] || 'desk'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const errs = []
const shot = async (ctxo, url, name, wait = 6500) => { const c = await b.newContext(ctxo); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(base + url); await p.waitForTimeout(wait); await p.screenshot({ path: `/workspace/meridian/shots/${pre}-${name}.png` }); await c.close() }
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  await shot({ viewport: { width: w, height: h } }, '/?intro=0', `${w}-home`)
  await shot({ viewport: { width: w, height: h } }, '/?intro=0&screen=pay', `${w}-pay`)
  await shot({ viewport: { width: w, height: h } }, '/?intro=0&screen=swap', `${w}-swap`)
}
await shot({ viewport: { width: 1440, height: 900 } }, '/?intro=1', '1440-intro-land', 3300)
await shot({ viewport: { width: 900, height: 1100 } }, '/?intro=0', '900-home')
await shot({ ...devices['iPhone 13'] }, '/?intro=0', '390-home')
await shot({ ...devices['iPhone 13'] }, '/?intro=0&screen=pay', '390-pay')
console.log('ERRORS', JSON.stringify(errs)); await b.close()
