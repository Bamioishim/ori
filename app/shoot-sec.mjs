import { chromium, devices } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:4317'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const errs = [], S = '/workspace/meridian/shots/sec-'
for (const [tag, o] of [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', { ...devices['iPhone 13'] }]]) {
  const c = await b.newContext(o); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
  const go = async (q, w = 3500) => { await p.goto(base + '/?intro=0' + q); await p.waitForTimeout(w) }
  await go(''); await p.screenshot({ path: `${S}${tag}-home.png`, fullPage: true })
  await go('&screen=policy'); await p.screenshot({ path: `${S}${tag}-policy.png`, fullPage: true })
  await go('&screen=scan', 6000); await p.screenshot({ path: `${S}${tag}-scanner.png`, fullPage: true })
  await go('&screen=pay', 5000); await p.fill('.field', '@newperson'); await p.fill('.amount input', '60'); await p.waitForTimeout(4000)
  await p.click('.cta.hold'); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}${tag}-confirm.png` })
  await p.click('.csheet .ack input'); await p.waitForTimeout(400); await p.screenshot({ path: `${S}${tag}-confirm-ack.png` })
  await go('&screen=pay', 5000); await p.fill('.amount input', '400'); await p.waitForTimeout(4000)
  await p.click('.cta.hold'); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}${tag}-blocked.png` })
  await c.close()
}
console.log('ERRORS', JSON.stringify(errs)); await b.close()
