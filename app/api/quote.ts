import { oneClick, validateQuoteInput } from './_oneclick.js'
import { requestBody, sendJson, sendResponse, type ApiRequest, type ApiResponse } from './_http.js'
export default async function handler(request:ApiRequest,response:ApiResponse){
 if(request.method!=='POST')return sendJson(response,{error:'Method not allowed.'},405)
 const input=validateQuoteInput(requestBody(request))
 if(typeof input==='string')return sendJson(response,{error:input},400)
 const result=await oneClick('/quote',{method:'POST',body:JSON.stringify({dry:false,swapType:'EXACT_INPUT',slippageTolerance:100,originAsset:input.originAsset,depositType:'ORIGIN_CHAIN',destinationAsset:input.destinationAsset,amount:input.amount,recipient:input.recipient,recipientType:'DESTINATION_CHAIN',refundTo:input.refundTo,refundType:'ORIGIN_CHAIN',deadline:input.deadline})})
 return sendResponse(response,result)
}