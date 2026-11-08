import { requestUrl, sendJson, type ApiRequest, type ApiResponse } from './_http.js'
declare const process: { env: Record<string, string | undefined> }
const SOLANA=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const HANDLE=/^@[a-z0-9][a-z0-9._-]{0,31}$/
type Entry={address:string;chain?:'solana';label?:string}
function directory():Record<string,Entry>{const raw=process.env.ORI_HANDLE_DIRECTORY;if(!raw)return {};try{return JSON.parse(raw) as Record<string,Entry>}catch{return {}}}
export default function handler(request:ApiRequest,response:ApiResponse){
 if(request.method!=='GET')return sendJson(response,{error:'Method not allowed.'},405)
 const raw=requestUrl(request).searchParams.get('handle')?.trim().toLowerCase()||''
 if(!HANDLE.test(raw))return sendJson(response,{error:'Use a handle such as @tolu.'},400)
 const entry=directory()[raw]
 if(!entry||(entry.chain&&entry.chain!=='solana')||!SOLANA.test(entry.address))return sendJson(response,{error:'This handle is not linked to a verified Solana address.'},404)
 return sendJson(response,{handle:raw,address:entry.address,chain:'solana',label:entry.label||raw})
}