import { chromium, devices } from '@playwright/test'
const S = '../shots/', U = 'http://localhost:4317/'
const A = ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'near']
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage()
p.on('console', m => m.type() === 'error' && console.log('console:', m.text()))
const go = async (q, ms) => { await p.goto(U + q); await p.waitForTimeout(ms) }
const full = async (n) => { await p.addStyleTag({ content: 'nav{position:static!important}.ori,.bubble{display:none}' }); await p.screenshot({ path: S + n, fullPage: true }) }
await go('?mode=live&addrs=' + A.join(','), 250); await p.screenshot({ path: S + 'live-loading.png' })
await p.waitForTimeout(5000); await p.screenshot({ path: S + 'live-home.png' })
await p.addStyleTag({ content: 'nav{position:static!important}' }); await p.screenshot({ path: S + 'live-home-full.png', fullPage: true })
await go('?mode=live&addrs=' + [A[0], 'doesnotexist-xyz-123.near'].join(','), 6000); await p.screenshot({ path: S + 'live-error.png', fullPage: true })
await p.addStyleTag({ content: 'nav{position:static!important}' }).catch(()=>{}); await go('?screen=pay&mode=live&addrs=' + A[0], 4500); await p.screenshot({ path: S + 'live-pay.png', fullPage: true })
await p.fill('.field', A[1]); await p.waitForTimeout(4000); await full('live-pay-sol.png')
await p.fill('.field', '0x098B716B8Aaf21512996dC57EB0615e2383E2f96'); await p.waitForTimeout(4000); await p.screenshot({ path: S + 'live-scam.png' }); await p.screenshot({ path: S + 'live-scam-full.png', fullPage: true })
await go('?screen=swap&mode=live&addrs=' + A[0], 4500); await p.screenshot({ path: S + 'live-swap.png', fullPage: true })
await ctx.setOffline(true); await p.fill('.amtin', '2'); await p.waitForTimeout(2500); await p.screenshot({ path: S + 'live-offline.png', fullPage: true })
await b.close()
