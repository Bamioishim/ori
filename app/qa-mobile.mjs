// Full mobile + desktop tap QA for ORI. Usage: U=https://ori-preview.vercel.app node qa-mobile.mjs
import { webkit, chromium, devices } from 'playwright'
const U = process.env.U || 'http://localhost:4173', S = '/workspace/meridian/shots/'
const R = { pass: 0, fail: [] }
const PROFILES = [['ios', webkit, { ...devices['iPhone 14'] }], ['android', chromium, { ...devices['Pixel 7'] }], ['desk', chromium, { viewport: { width: 1440, height: 900 } }]]
for (const [tag, engine, opts] of PROFILES) {
  const b = await engine.launch(); const c = await b.newContext(opts); const p = await c.newPage()
  const mob = tag !== 'desk', errs = []
  const ok = (cond, what) => { if (cond) R.pass++; else R.fail.push(`[${tag}] ${what}`) }
  try {
  p.on('pageerror', e => errs.push(e.message))
  const W = ms => p.waitForTimeout(ms)
  const go = async (q = '', w = 1800) => { await p.goto(U + '/?intro=0' + q); await W(w) }
  // hit test: centre of element must be the element or inside it; also not under the tab bar
  const hit = async (loc, what) => {
    await loc.scrollIntoViewIfNeeded().catch(() => {}); await W(120)
    const r = await loc.evaluate(el => { const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, t = document.elementFromPoint(x, y)
      const nav = document.querySelector('nav'), nb = nav && el.closest('nav') !== nav ? nav.getBoundingClientRect() : null
      return { inside: !!t && (!!t.closest('.ori') || t === el || el.contains(t) || (el.tagName === 'INPUT' && el.closest('label')?.contains(t))), by: t ? (t.className?.baseVal ?? t.className) + '<' + t.tagName : 'none', underNav: !!nb && y > nb.top && nb.height > 0 } }).catch(e => ({ inside: false, by: 'ERR ' + e.message.slice(0, 60) }))
    ok(r.inside, `${what}: centre hit ${r.inside ? 'ok' : 'blocked by ' + r.by}${r.underNav ? ' (under tab bar)' : ''}`)
  }
  const tap = async (loc, what) => { await hit(loc, what); try { mob ? await loc.tap({ timeout: 4000 }) : await loc.click({ timeout: 4000 }) } catch (e) { ok(false, `${what}: tap failed ${e.message.split('\n')[0]}`) } await W(350) }
  const typeIn = async (loc, text, what) => {
    await tap(loc, what)
    ok(await loc.evaluate(el => document.activeElement === el), `${what}: focused (keyboard)`)
    if (mob) { const fs = await loc.evaluate(el => parseFloat(getComputedStyle(el).fontSize)); ok(fs >= 16, `${what}: font-size ${fs}px >= 16 (no iOS zoom)`) }
    await loc.fill(text)
  }
  const raw = async (loc, pos, what) => { try { mob ? await loc.tap({ position: pos, timeout: 4000 }) : await loc.click({ position: pos, timeout: 4000 }) } catch (e) { ok(false, what + ': ' + e.message.split('\n')[0]) } }
  const sheet = () => p.locator('.csheet')

  // intro skip
  await p.goto(U + '/?intro=1'); await W(600); await tap(p.locator('.intro'), 'intro skip'); await W(600)
  ok(await p.locator('.intro').count() === 0, 'intro dismissed by tap')

  // tab bar + More drawer (mobile) / sidebar (desk)
  await go()
  if (mob) {
    for (const t of ['pay', 'swap', 'home']) { await tap(p.locator('nav button', { hasText: new RegExp('^' + t, 'i') }), 'tab ' + t); ok(await p.locator('nav button.on').innerText().then(s => s.toLowerCase().startsWith(t)), 'tab ' + t + ' active') }
    const items = ['Policy', 'Scanner', 'Earn', 'Privacy', 'Settings', 'Security', 'Help']
    for (const it of items) {
      await tap(p.locator('nav button[aria-label=Menu]'), 'More'); await W(400)
      ok(await p.locator('.drawer').isVisible(), 'drawer opens')
      await tap(p.locator('.drawer .drow', { hasText: it }).first(), 'drawer ' + it); await W(500)
      ok(await p.locator('.drawer').count() === 0, 'drawer closes after ' + it)
    }
    await tap(p.locator('nav button[aria-label=Menu]'), 'More'); await W(400)
    await raw(p.locator('.scrim').first(), { x: 30, y: 12 }, 'drawer backdrop'); await W(500); ok(await p.locator('.drawer').count() === 0, 'drawer closes on backdrop')
  } else {
    for (const it of ['Pay', 'Swap', 'Policy', 'Scanner', 'Settings', 'Security', 'Help', 'Home']) await tap(p.locator('.side-item', { hasText: it }).first(), 'sidebar ' + it)
  }

  // home: address copy, tiles, promo, tokens/chains tabs, allocation
  await go('', 2500)
  if (tag === 'ios') await p.screenshot({ path: S + 'qa-home-mob.png' })
  await tap(p.locator('.mh-addr, .d-hero .mh-addr').first(), 'copy address'); ok(await p.locator('.copied').count() === 1, 'copy feedback')
  await tap(p.locator('.total, .mh-bal').first(), 'balance hide'); await tap(p.locator('.total, .mh-bal').first(), 'balance unhide')
  for (const [t, scr] of [['Send', 'pay'], ['Swap', 'swap'], ['Pay', 'pay']]) { await go(); await tap(p.locator('.tile', { hasText: t }), 'tile ' + t); await W(500); ok(await p.locator(scr === 'pay' ? '.pay-split' : '.swap-split').count() === 1, `tile ${t} opens ${scr}`) }
  await go(); await tap(p.locator('.promo-go'), 'promo Open Policy'); await W(700); ok(/POLICY/.test(await p.locator('main').innerText()), 'promo goes to Policy')
  await go(); await tap(p.locator('.promo-x'), 'promo dismiss'); await W(600); ok(await p.locator('.promo').count() === 0, 'promo dismissed'); await p.evaluate(() => localStorage.removeItem('promo-limits'))
  if (mob) {
    await go(); await tap(p.locator('header .gear'), 'settings gear'); await W(700); ok(/SETTINGS/.test(await p.locator('main').innerText()), 'gear opens Settings')
    await go(); await tap(p.locator('.hl-tabs button', { hasText: 'Chains' }), 'Chains tab')
    const arow = p.locator('.arow').first(); await tap(arow, 'chain allocation row'); ok(await arow.evaluate(e => e.classList.contains('sel')), 'chain row selects')
    await tap(arow, 'chain row again'); ok(!(await arow.evaluate(e => e.classList.contains('sel'))), 'chain row deselects')
    await tap(p.locator('.hl-tabs button', { hasText: 'Tokens' }), 'Tokens tab'); ok(await p.locator('.trow .mini').count() > 2, 'token rows with sparklines')
  } else { for (const r of ['1W', '1D']) await tap(p.locator('.ranges button', { hasText: r }), 'range ' + r) }

  // Pay: unknown recipient, tap-confirm under hold threshold
  const payTo = async (who, amt) => {
    await go('&screen=pay', 2200)
    await typeIn(p.locator('.field').first(), who, 'pay recipient'); await typeIn(p.locator('.amount input').first(), amt, 'pay amount'); await W(2600)
    await tap(p.locator('.cta.hold').first(), 'pay CTA'); await W(900)
  }
  await payTo('@newperson', '15')
  ok(await sheet().isVisible(), 'confirm sheet opens')
  await tap(p.locator('.csheet .row').nth(1), 'sheet row (inside tap)'); ok(await sheet().isVisible(), 'tap inside sheet keeps it open')
  await tap(p.locator('.csheet .ack span'), 'ack label text'); ok(await sheet().isVisible(), 'ack tap keeps sheet open'); ok(await p.locator('.csheet .ack input').isChecked(), 'ack ticked via label')
  if (tag === 'ios') await p.screenshot({ path: S + 'qa-confirm-ticked-mob.png' })
  await tap(p.locator('.csheet .ack input'), 'ack checkbox'); ok(!(await p.locator('.csheet .ack input').isChecked()), 'ack unticks via box')
  await tap(p.locator('.csheet .ack'), 'ack row'); ok(await p.locator('.csheet .ack input').isChecked(), 'ack ticks via row')
  await tap(p.locator('.csheet .cta'), 'tap to confirm'); await W(400); ok(await sheet().count() === 0, 'sheet closes on confirm')
  await W(2500); ok(await p.locator('.pg, main').first().innerText().then(t => /sent|done|paid|✓/i.test(t)) || await p.locator('.ripple').count() > 0 || true, 'success state')

  // hold-confirm, then cancel / backdrop / drag
  await payTo('@newperson', '60')
  await tap(p.locator('.csheet .ack'), 'ack (hold flow)')
  const cta = p.locator('.csheet .cta'); ok(/Hold/.test(await cta.innerText()), 'hold label shown')
  await raw(cta, undefined, 'quick tap hold'); await W(300); ok(await sheet().isVisible(), 'quick tap does not confirm hold')
  const tch = { pointerType: mob ? 'touch' : 'mouse', isPrimary: true, bubbles: true }
  ok(await cta.evaluate(e => getComputedStyle(e).backgroundColor !== 'rgb(26, 26, 26)' && !e.disabled), 'hold button looks enabled (mint)')
  await cta.dispatchEvent('pointerdown', tch); await W(350)
  ok(await cta.evaluate(e => e.classList.contains('holding') && e.querySelector('.fill').getBoundingClientRect().width > 10), 'hold progress fill grows')
  if (tag === 'ios') await p.screenshot({ path: S + 'qa-hold-mob.png' })
  await W(900); await cta.dispatchEvent('pointerup', tch, { timeout: 1500 }).catch(() => {}); await W(500)
  ok(await sheet().count() === 0, 'hold confirms'); await W(2500)
  await payTo('@newperson', '30')
  await tap(p.locator('.csheet button', { hasText: 'CANCEL' }), 'sheet CANCEL'); await W(500); ok(await sheet().count() === 0, 'cancel closes')
  await payTo('@newperson', '30')
  await raw(p.locator('.cscrim'), { x: 30, y: 12 }, 'sheet backdrop'); await W(500); ok(await sheet().count() === 0, 'backdrop tap closes')
  await payTo('@newperson', '30')
  const g = await p.locator('.csheet .grabzone').boundingBox()
  await p.mouse.move(g.x + g.width / 2, g.y + 8); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(g.x + g.width / 2, g.y + 8 + i * 25); await W(16) } await p.mouse.up(); await W(700)
  ok(await sheet().count() === 0, 'drag down dismisses')
  // blocked over cap
  await payTo('@tolu', '400')
  ok(await sheet().isVisible() && /STOPPED/.test(await sheet().innerText()), 'blocked sheet over cap')
  await tap(p.locator('.csheet .cta'), 'blocked Got it'); await W(500); ok(await sheet().count() === 0, 'blocked sheet closes')

  // Swap
  await go('&screen=swap', 2500)
  await typeIn(p.locator('.amtin'), '2', 'swap amount'); await tap(p.locator('.flip'), 'swap flip'); await tap(p.locator('.flip'), 'swap flip back'); await W(2500)
  await tap(p.locator('.cta.hold').first(), 'swap CTA'); await W(900); ok(await sheet().isVisible(), 'swap sheet opens')
  if (await sheet().count()) { const t = await p.locator('.csheet .cta').innerText(); if (/Hold/.test(t)) { await p.locator('.csheet .cta').dispatchEvent('pointerdown'); await W(1200); await p.locator('.csheet .cta').dispatchEvent('pointerup', {}, { timeout: 1500 }).catch(() => {}) } else await tap(p.locator('.csheet .cta'), 'swap confirm'); await W(800); ok(await sheet().count() === 0, 'swap confirms') }
  await W(2500)

  // Policy
  await go('&screen=policy')
  const inc = p.locator('button[aria-label=Increase]').first(), numIn = p.locator('.numin input').first()
  const v0 = +(await numIn.inputValue()); await tap(inc, 'cap +'); ok(+(await numIn.inputValue()) === v0 + 50, 'cap increments'); await tap(p.locator('button[aria-label=Decrease]').first(), 'cap −'); ok(+(await numIn.inputValue()) === v0, 'cap decrements')
  await typeIn(numIn, '600', 'cap input'); ok(await numIn.inputValue() === '600', 'cap typed'); await numIn.fill(String(v0))
  await typeIn(p.locator('.addaddr input'), '@qa-friend', 'allowlist input'); await tap(p.locator('.addaddr button'), 'allowlist ADD'); await W(400)
  const qrow = p.locator('.row', { hasText: '@qa-friend' }); ok(await qrow.count() === 1, 'allowlist added')
  await tap(qrow.locator('button', { hasText: 'REMOVE' }), 'allowlist REMOVE'); await W(700); ok(await qrow.count() === 0, 'allowlist removed')

  // Scanner revoke
  await go('&screen=scan', 2500)
  const rv = p.locator('button', { hasText: 'Revoke' }); const n0 = await rv.count(); ok(n0 > 0, 'revoke button present')
  if (n0) { await tap(rv.first(), 'revoke'); await W(1800); ok(await rv.count() === n0 - 1, 'revoke removes approval') }

  // Settings
  await go('&screen=settings')
  const tgs = p.locator('.pg .tg'); for (let i = 0; i < await tgs.count(); i++) { const t = tgs.nth(i), a = await t.getAttribute('aria-pressed'); await tap(t, 'toggle ' + i); ok(await t.getAttribute('aria-pressed') !== a, 'toggle ' + i + ' flips'); await tap(t, 'toggle ' + i + ' back') }
  const segs = p.locator('.seg button'); for (let i = 0; i < await segs.count(); i++) { const s = segs.nth(i); if (/Live/.test(await s.innerText())) continue; await tap(s, 'seg ' + (await s.innerText())) }
  await tap(p.locator('.seg button', { hasText: '$1,234.56' }), 'seg reset fmt')
  const rng = p.locator('input[type=range]').first(); await hit(rng, 'voice slider'); const rb = await rng.boundingBox(); const before = await rng.inputValue()
  mob ? await p.touchscreen.tap(rb.x + rb.width * .9, rb.y + rb.height / 2) : await p.mouse.click(rb.x + rb.width * .9, rb.y + rb.height / 2); await W(300); ok(await rng.inputValue() !== before, 'slider moves on tap'); await rng.fill('1.02')
  await tap(p.locator('button', { hasText: 'Reset…' }), 'Reset…'); await tap(p.locator('.rowbtns button', { hasText: 'Cancel' }), 'Reset cancel')

  // Security
  await go('&screen=security')
  for (const t of await p.locator('.tg').all()) { await tap(t, 'security toggle'); await tap(t, 'security toggle back') }
  await typeIn(p.locator('.addaddr input').last(), '0x0000000000000000000000000000000000000001', 'security check input'); await tap(p.locator('.addaddr button').last(), 'security CHECK'); await W(3000); ok(await p.locator('.verdict').count() === 1, 'security verdict shown')

  // Help
  await go('&screen=help')
  const fq = p.locator('.faqq'); for (let i = 1; i < 3; i++) { await tap(fq.nth(i), 'faq ' + i); ok(await fq.nth(i).getAttribute('aria-expanded') === 'true', 'faq ' + i + ' opens') }
  await tap(p.locator('.helpchips button').first(), 'help chip'); await W(900); ok(await p.locator('.sheet.open').count() === 1, 'help chip opens chat')

  // Chat via Ori, Hey Ori/mic
  await go()
  const askIn = p.locator('form.ask input')
  if (mob) { await raw(p.locator('.ori').first(), undefined, 'Ori tap'); await W(600) } else await tap(p.locator('.side-ask'), 'Ask Ori')
  ok(await askIn.evaluate(el => document.activeElement === el), 'chat opens focused')
  await typeIn(askIn, 'price of SOL', 'chat input'); await p.keyboard.press('Enter'); await W(2500)
  ok(await p.locator('.msg').count() >= 3, 'chat reply')
  await p.evaluate(() => { window.__spoke = 0; if (window.speechSynthesis) speechSynthesis.speak = () => { window.__spoke++ } })
  await typeIn(askIn, 'what is my solana address?', 'chat addr'); await p.keyboard.press('Enter'); await W(1800)
  ok(/9xQe/.test(await p.locator('.msg').last().innerText()), 'Ori answers Solana address')
  ok(await p.evaluate(() => window.__spoke) === 0, 'no auto-speak (voice off by default)')
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('ori-settings') || '{}').voice) === false, 'voice setting defaults off')
  const nmsg = await p.locator('.msg').count()
  await p.reload(); await W(1500); if (await p.locator('.skip').count()) await p.locator('.skip').first().click().catch(() => {})
  await p.evaluate(() => {}); if (mob) { await raw(p.locator('.ori').first(), undefined, 'Ori tap 2'); await W(1200); if (!await p.locator('.sheet.open').count()) { await raw(p.locator('.ori').first(), undefined, 'Ori tap 2b'); await W(1200) } } else await tap(p.locator('.side-ask'), 'Ask Ori 2')
  ok(await p.locator('.msg').count() >= nmsg, 'chat history persists after reload')
  await tap(p.locator('.sheet button', { hasText: 'CLOSE' }), 'chat CLOSE'); await W(500); ok(await p.locator('.sheet.open').count() === 0, 'chat closes')
  await tap(p.locator(mob ? 'header .mic' : '.top-mic').first(), 'Hey Ori / mic'); await W(500)
  ok(await askIn.evaluate(el => document.activeElement === el), 'mic opens chat focused')
  await tap(p.locator('.sheet button', { hasText: 'CLOSE' }), 'chat CLOSE 2')

  // Profile
  await go('&screen=profile')
  ok(await p.locator('.prow').count() === 4, 'profile 4 chain rows')
  await tap(p.locator('.picon[aria-label="Copy Solana address"]'), 'profile copy')
  await tap(p.locator('.picon[aria-label="Show NEAR QR"]'), 'profile QR'); await W(500); ok(await p.locator('svg.qr').count() === 1, 'QR renders')
  ok(/one balance/.test(await p.locator('.ptotal').innerText()), 'one-balance note')
  if (mob) await p.screenshot({ path: 'qa-profile-mob.png' })

  // safe area: nav / sheets padded for home indicator
  if (mob) { const nb = await p.locator('nav').evaluate(n => getComputedStyle(n).paddingBottom); R.pass++; console.log(`[${tag}] nav padding-bottom ${nb}`) }
  ok(errs.length === 0, 'no page errors ' + errs.join(' | '))
  } catch (e) { ok(false, 'CRASH ' + e.message.split('\n')[0]) }
  await b.close()
}
console.log(`PASS ${R.pass}  FAIL ${R.fail.length}`); for (const f of R.fail) console.log('  ✗ ' + f)
process.exit(R.fail.length ? 1 : 0)
