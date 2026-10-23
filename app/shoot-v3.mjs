import { chromium, devices } from '@playwright/test'
const base = process.argv[2] || 'http://localhost:4317', pre = process.argv[3] || 'v3'
const b = await chromium.launch({ executablePath: '/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' })
const errs = []; const D = { viewport: { width: 1440, height: 900 } }
const open = async (o, url) => { const c = await b.newContext(o); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(base + url); await p.waitForTimeout(4500); return [c, p] }
const out = n => `/workspace/meridian/shots/${pre}-${n}.png`
{ const [c, p] = await open(D, '/?intro=0&screen=swap'); await p.waitForSelector('text=Hold to swap', { timeout: 20000 }); const bt = p.locator('button.cta'); const bb = await bt.boundingBox()
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(1100); await p.mouse.up()
  await p.waitForSelector('text=SWAP RECEIPT', { timeout: 20000 }); await p.waitForTimeout(1500); await p.screenshot({ path: out('1440-swap-success') }); await c.close() }
for (const s of ['settings', 'security', 'help']) { const [c, p] = await open(D, '/?intro=0&screen=' + s); await p.screenshot({ path: out('1440-' + s) }); await c.close() }
for (const [n, q] of [['balance', 'What’s my balance?'], ['price', 'What is the price of SOL?']]) {
  const [c, p] = await open(D, '/?intro=0'); await p.click('.side-ask'); await p.waitForTimeout(800); await p.fill('.ask input', q); await p.press('.ask input', 'Enter'); await p.waitForTimeout(4000); await p.screenshot({ path: out('1440-chat-' + n) })
  console.log(n, await p.locator('.msg.bot').last().innerText()); await c.close() }
{ const [c, p] = await open({ ...devices['iPhone 13'] }, '/?intro=0'); await p.screenshot({ path: out('390-home') }); await c.close() }
{ const [c, p] = await open({ ...devices['iPhone 13'] }, '/?intro=0&menu=1'); await p.screenshot({ path: out('390-menu') }); await c.close() }
console.log('ERRORS', JSON.stringify(errs)); await b.close()
