import { chromium, devices } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:4317'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const S = '/workspace/meridian/shots/bubblefix-', errs = [], out = {}
const info = p => p.evaluate(() => { const e = document.querySelector('.bubble'); if (!e) return null; const r = e.getBoundingClientRect()
  const hits = [...document.querySelectorAll('.appr, .pwarn, .fitem, button, h1, h2, .csum')].filter(c => { const q = c.getBoundingClientRect(); return q.width && !(q.right <= r.left || q.left >= r.right || q.bottom <= r.top || q.top >= r.bottom) }).length
  return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), vw: innerWidth, vh: innerHeight, hits, side: e.parentElement.dataset.side } })
for (const [tag, o] of [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', { ...devices['iPhone 13'] }]]) {
  const c = await b.newContext(o); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message))
  const go = async (q, w) => { await p.goto(base + '/?intro=0' + q); await p.waitForTimeout(w) }
  await go('&screen=scan', 6000); await p.dblclick('.ori'); await p.waitForTimeout(500)
  out[tag + '-scan-bubble'] = await info(p); await p.screenshot({ path: `${S}${tag}-scanner.png` })
  await p.waitForTimeout(5000); out[tag + '-scan-after5s'] = await info(p)
  await go('&screen=pay', 5000); await p.fill('.field', '@newperson'); await p.fill('.amount input', '60'); await p.waitForTimeout(1500)
  await p.click('.cta.hold'); await p.waitForTimeout(1200)
  await p.evaluate(() => window.dispatchEvent(new Event('noop')))
  out[tag + '-confirm-bubble'] = await info(p); await p.screenshot({ path: `${S}${tag}-confirm.png` })
  await c.close()
}
console.log(JSON.stringify(out, null, 1), 'ERRORS', JSON.stringify(errs)); await b.close()
