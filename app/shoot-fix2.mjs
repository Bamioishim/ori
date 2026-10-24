import { webkit, devices } from 'playwright'
const U=process.env.U||'http://localhost:4173', S='/workspace/meridian/shots/'
const b=await webkit.launch(); const c=await b.newContext({...devices['iPhone 14']}); const m=await c.newPage()
await m.goto(U+'/?intro=0');await m.waitForTimeout(1500)
await m.locator('.ori').first().tap();await m.waitForTimeout(700)
console.log('after Ori tap active:',await m.evaluate(()=>document.activeElement?.outerHTML.slice(0,60)))
await m.locator('form.ask input').tap();console.log('after input tap:',await m.evaluate(()=>document.activeElement===document.querySelector('form.ask input')))
const hit=await m.evaluate(()=>{const r=document.querySelector('form.ask input').getBoundingClientRect();return document.elementFromPoint(r.x+20,r.y+r.height/2)?.tagName});console.log('hit at input:',hit)
await m.keyboard.type('what is my balance');await m.keyboard.press('Enter');await m.waitForTimeout(2000)
console.log('msgs',(await m.locator('.msg').allInnerTexts()).slice(-2))
await m.screenshot({path:S+'fix2-chat-mob.png'})
await m.locator('.scrim').tap({position:{x:20,y:60}});await m.waitForTimeout(600)
await m.locator('header .mic').tap();await m.waitForTimeout(500);console.log('heyori opens+focus:',await m.evaluate(()=>document.activeElement===document.querySelector('form.ask input')))
await b.close()
