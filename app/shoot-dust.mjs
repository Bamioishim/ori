import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
let ctx = await b.newContext({ ...devices['iPhone 13'] }); let p = await ctx.newPage()
await p.goto('http://localhost:4317/'); await p.waitForTimeout(1800); await p.screenshot({ path: '../shots/black-home.png' })
await ctx.close()
ctx = await b.newContext({ ...devices['iPhone 13'], recordVideo: { dir: '/tmp/vid', size: { width: 390, height: 664 } } }); p = await ctx.newPage()
await p.goto('http://localhost:4317/'); await p.waitForTimeout(6000); const v = p.video(); await ctx.close(); await v.saveAs('/tmp/dust.webm')
await b.close()
