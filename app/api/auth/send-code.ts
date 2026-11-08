import nodemailer from 'nodemailer'
import { requestBody, sendJson, type ApiRequest, type ApiResponse } from '../_http.js'
declare const process:{env:Record<string,string|undefined>}
const bytes=(s:string)=>new TextEncoder().encode(s)
const b64url=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
const digestHex=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')
const sign=async(s:string,key:string)=>b64url(new Uint8Array(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',bytes(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),bytes(s))))
export default async function handler(req:ApiRequest,res:ApiResponse){
 if(req.method!=='POST')return sendJson(res,{error:'Method not allowed.'},405)
 const body=requestBody<{email?:string}>(req),email=String(body.email||'').trim().toLowerCase()
 if(!/^[^\s@]+@gmail\.com$/.test(email))return sendJson(res,{error:'Use the Gmail address attached to your ORI account.'},400)
 const key=process.env.ORI_AUTH_CODE_SECRET,user=process.env.GMAIL_OAUTH_USER,clientId=process.env.GOOGLE_OAUTH_CLIENT_ID,clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET,refreshToken=process.env.GMAIL_OAUTH_REFRESH_TOKEN,from=process.env.GMAIL_OAUTH_FROM||user
 if(!key||!user||!clientId||!clientSecret||!refreshToken||!from)return sendJson(res,{error:'Gmail recovery is not configured yet. Add the Google OAuth2 mail settings before requesting a code.'},503)
 const random=new Uint32Array(1);crypto.getRandomValues(random);const code=String(100000+(random[0]%900000)),exp=Date.now()+10*60*1000
 const payload=JSON.stringify({email,exp,hash:await digestHex(code)}),encoded=b64url(bytes(payload)),sig=await sign(encoded,key)
 try{const transporter=nodemailer.createTransport({service:'gmail',auth:{type:'OAuth2',user,clientId,clientSecret,refreshToken}});await transporter.sendMail({from,to:email,subject:'Your ORI recovery code',text:`Your ORI recovery code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`})}
 catch{return sendJson(res,{error:'The Gmail recovery email could not be sent. Check the Google OAuth2 mail configuration.'},502)}
 return sendJson(res,{challenge:`${encoded}.${sig}`,expiresAt:exp})
}