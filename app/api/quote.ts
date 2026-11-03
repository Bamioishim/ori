import { json, oneClick, validateQuoteInput } from './_oneclick.js'

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'Invalid JSON body.' }, 400) }
  const input = validateQuoteInput(body)
  if (typeof input === 'string') return json({ error: input }, 400)
  return oneClick('/quote', {
    method: 'POST',
    body: JSON.stringify({
      dry: false,
      swapType: 'EXACT_INPUT',
      slippageTolerance: 100,
      originAsset: input.originAsset,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset: input.destinationAsset,
      amount: input.amount,
      recipient: input.recipient,
      recipientType: 'DESTINATION_CHAIN',
      refundTo: input.refundTo,
      refundType: 'ORIGIN_CHAIN',
      deadline: input.deadline,
    }),
  })
}
