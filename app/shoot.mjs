import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' }); const ctx = await b.newContext({ ...devices['iPhone 13'] })
const p = await ctx.newPage()
for (const s of ['home','pay','swap','earn','privacy']) {
  await p.goto('http://localhost:4317/?screen='+s); await p.waitForTimeout(1800)
  await p.screenshot({ path: `../shots/${s}.png` })
  await p.addStyleTag({ content: 'nav{position:static!important;transform:none!important}' })
  await p.screenshot({ path: `../shots/${s}-full.png`, fullPage: true })
}
await b.close()
