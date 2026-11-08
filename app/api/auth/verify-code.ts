import { requestBody, sendJson, type ApiRequest, type ApiResponse } from '../_http.js'
declare const process:{env:Record<string,string|undefined>}
const bytes=(s:string)=>new TextEncoder().encode(s)
const fromB64url=(s:string)=>{const raw=atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4));return new TextDecoder().decode(Uint8Array.from(raw,c=>c.charCodeAt(0)))}
const b64url=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const digestHex=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')
const sign=async(s:string,key:string)=>b64url(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',bytes(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes(s))))
const same=(a:string,b:string)=>a.length===b.length&&[...a].reduce((ok,c,i)=>ok&&c===b[i],true)
export default async function handler(req:ApiRequest,res:ApiResponse){
 if(req.method!=='POST')return sendJson(res,{error:'Method not allowed.'},405)
 const body=requestBody<{challenge?:string;code?:string}>(req),parts=String(body.challenge||'').split('.'),key=process.env.ORI_AUTH_CODE_SECRET
 if(!key||parts.length!==2||!/^\d{6}$/.test(String(body.code||'')))return sendJson(res,{error:'That code is invalid or expired.'},400)
 if(!same(await sign(parts[0],key),parts[1]))return sendJson(res,{error:'That code is invalid or expired.'},400)
 let payload:{email:string;exp:number;hash:string};try{payload=JSON.parse(fromB64url(parts[0]))}catch{return sendJson(res,{error:'That code is invalid or expired.'},400)}
 if(!payload.email||payload.exp<Date.now()||payload.hash!==await digestHex(String(body.code)))return sendJson(res,{error:'That code is invalid or expired.'},400)
 return sendJson(res,{verified:true,email:payload.email})
}