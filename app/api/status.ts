import { oneClick } from './_oneclick.js'
import { requestUrl, sendJson, sendResponse, type ApiRequest, type ApiResponse } from './_http.js'
export default async function handler(request:ApiRequest,response:ApiResponse){
 if(request.method!=='GET')return sendJson(response,{error:'Method not allowed.'},405)
 const url=requestUrl(request),depositAddress=url.searchParams.get('depositAddress')?.trim(),depositMemo=url.searchParams.get('depositMemo')?.trim()
 if(!depositAddress)return sendJson(response,{error:'depositAddress is required.'},400)
 const params=new URLSearchParams({depositAddress});if(depositMemo)params.set('depositMemo',depositMemo)
 return sendResponse(response,await oneClick('/status?'+params.toString(),{method:'GET'}))
}