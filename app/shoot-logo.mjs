import { chromium } from 'playwright'
const U=process.env.U||'https://ori-preview.vercel.app', S='/workspace/meridian/shots/'
const b=await chromium.launch({executablePath:'/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'})
const d=await b.newPage({viewport:{width:1440,height:900}});await d.goto(U+'/?intro=0');await d.waitForTimeout(1800);await d.screenshot({path:S+'logo-desk.png'})
const m=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await m.goto(U+'/?intro=0');await m.waitForTimeout(1800);await m.screenshot({path:S+'logo-mob.png'})
await m.goto(U+'/?stage=mark');await m.waitForTimeout(1200);await m.screenshot({path:S+'logo-intro.png'})
await b.close()
