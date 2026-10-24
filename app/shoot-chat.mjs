import { chromium, devices } from '@playwright/test'
const U = process.argv[2] || 'http://localhost:4317'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
for (const [k, o] of [['desk', { viewport: { width: 1440, height: 900 } }], ['mob', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }]]) {
  const c = await b.newContext(o); const p = await c.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); await p.goto(U + '/?intro=0'); await p.waitForTimeout(6500)
  const btn = p.locator('.ori').first(); await p.waitForTimeout(500); const bb = await btn.boundingBox()
  const top = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.outerHTML.slice(0, 120) }, [bb.x + bb.width / 2, bb.y + bb.height / 2])
  console.log(k, 'top at HeyOri:', top)
  if (k === 'mob') await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); else await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2)
  await p.waitForTimeout(1200)
  const inp = p.locator('form.ask input'); console.log(k, 'input visible', await inp.isVisible().catch(() => false))
  if (await inp.isVisible().catch(() => false)) { await inp.fill('what is my balance'); await inp.press('Enter'); await p.waitForTimeout(2500); console.log(k, 'msgs', await p.locator('.msg').count()) }
  await p.screenshot({ path: `/tmp/chat-${k}.png` }); await c.close()
}
await b.close()
