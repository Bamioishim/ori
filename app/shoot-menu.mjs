import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const p = await (await b.newContext({ ...devices['iPhone 13'] })).newPage()
await p.goto('http://localhost:4317/'); await p.waitForTimeout(1800); await p.screenshot({ path: '../shots/nav3-home.png' })
await p.click('nav button[aria-label="Menu"]'); await p.waitForTimeout(1200); await p.screenshot({ path: '../shots/nav3-menu-open.png' })
await b.close()
