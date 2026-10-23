import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage()
await p.goto('http://localhost:4317/?intro=1')
for (const [ms, n] of [[700,'1-black'],[2300,'2-wordmark'],[3150,'3-landing'],[3500,'3b-landing'],[5200,'4-home']]) { await p.waitForTimeout(ms - (p._t||0)); p._t = ms; await p.screenshot({ path: `../shots/intro-${n}.png` }) }
await p.goto('http://localhost:4317/?screen=pay&intro=0'); await p.waitForTimeout(150); await p.screenshot({ path: '../shots/loader-quote.png' })
await p.waitForTimeout(3000)
const box = await p.locator('.cta.hold').boundingBox(); await p.locator('.cta.hold').scrollIntoViewIfNeeded()
const bb = await p.locator('.cta.hold').boundingBox()
await p.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2); await p.mouse.down()
for (let i = 0; i < 40; i++) { await p.waitForTimeout(150); const t = await p.locator('.cta.hold').innerHTML().catch(()=> ''); if (t.includes('dots')) { await p.screenshot({ path: '../shots/loader-pay.png' }); break } }
await p.mouse.up()
for (let i = 0; i < 80; i++) { await p.waitForTimeout(100); if (await p.locator('.cta.hold svg[aria-label="Done"]').count()) { await p.waitForTimeout(350); await p.screenshot({ path: '../shots/check-pop.png' }); break } }
await p.waitForTimeout(250); await p.screenshot({ path: '../shots/check-expand.png' })
await p.waitForTimeout(1200); await p.screenshot({ path: '../shots/receipt-after.png' })
await p.goto('http://localhost:4317/?intro=0&menu=1'); await p.waitForTimeout(1500); await p.screenshot({ path: '../shots/menu-ori-aside.png' })
await b.close()
