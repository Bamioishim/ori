import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(process.argv[2] || 'http://localhost:4317/?intro=1'); const t0 = Date.now()
for (const t of [2400, 3250, 3600, 4600]) { await p.waitForTimeout(t - (Date.now() - t0)); await p.screenshot({ path: `/workspace/meridian/shots/desk-intro-${t}.png` }) }
await b.close()
