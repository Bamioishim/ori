import { chromium, devices } from '@playwright/test'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const go = async (o, name, sel) => { const c = await b.newContext(o); const p = await c.newPage(); await p.goto('https://ori-preview.vercel.app/?intro=0'); await p.waitForTimeout(6500); await p.evaluate(s => { const e = document.querySelector(s); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 140) }, sel); await p.waitForTimeout(800); await p.screenshot({ path: `/workspace/meridian/shots/${name}.png` }); await c.close() }
await go({ viewport: { width: 1440, height: 900 } }, 'alloc-muted-desktop', '.d-chains')
await go({ ...devices['iPhone 13'] }, 'alloc-muted-mobile', '.alloc')
await b.close()
