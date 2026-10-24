import { chromium } from 'playwright'
const U='https://ori-preview.vercel.app', S='/workspace/meridian/shots/'
const b=await chromium.launch({executablePath:'/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'})
const m=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true})
await m.goto(U+'/?intro=0');await m.waitForTimeout(1500)
await m.locator('.ori').first().tap();await m.waitForTimeout(600)
await m.fill('form.ask input','hi ori');await m.keyboard.press('Enter');await m.waitForTimeout(1800)
await m.screenshot({path:S+'fix-chat-mob.png'})
// ripple: inject via React-independent replica isn't valid; trigger real pay flow
await m.goto(U+'/?intro=0');await m.waitForTimeout(1200)
console.log('buttons',await m.locator('button').allInnerTexts())
const d=await b.newPage({viewport:{width:1440,height:900}})
await d.goto(U+'/?intro=0');await d.waitForTimeout(1500);await d.screenshot({path:S+'fix-panels-desk.png'})
console.log('0N labels', (await d.locator('body').innerText()).match(/\b0[1-9]\b/g))
await b.close()
