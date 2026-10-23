import { chromium } from '/workspace/meridian/app/node_modules/@playwright/test/index.mjs'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const p = await b.newPage({ viewport: { width: 1800, height: 900 } })
await p.goto('file:///workspace/meridian/mascot/concepts.html'); await p.waitForTimeout(1200)
await p.screenshot({ path: '/workspace/meridian/mascot/concepts.png', fullPage: true }); await b.close()
