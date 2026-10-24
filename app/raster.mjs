import { chromium } from 'playwright'; import fs from 'fs'
const B='/workspace/meridian/brand/'
const b=await chromium.launch({executablePath:'/home/box/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'})
const p=await b.newPage()
async function r(svg,w,h,out){await p.setViewportSize({width:w,height:h});await p.setContent(`<style>*{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>`+fs.readFileSync(B+svg,'utf8'));await p.screenshot({path:B+out})}
for(const s of [180,192,512]) await r('ori-mark-bg.svg',s,s,`icon-${s}.png`)
await r('og.svg',1200,630,'og.png'); await r('ori-stacked-bg.svg',1284,1258,'compare.png')
await b.close()
