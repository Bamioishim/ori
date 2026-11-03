const ONECLICK = 'https://1click.chaindefuser.com/v0'

declare const process: { env: Record<string, string | undefined> }

export const ALLOWED_ASSETS = new Set([
  'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
  'nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near',
])

const ADDRESS_PATTERNS = [
  /^0x[0-9a-fA-F]{40}$/,
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  /^([a-z0-9_-]+\.)*[a-z0-9_-]+\.(near|tg)$/,
]

export type QuoteInput = {
  originAsset: string
  destinationAsset: string
  amount: string
  recipient: string
  refundTo: string
  deadline?: string
}

export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

export function validateQuoteInput(input: unknown): QuoteInput | string {
  if (!input || typeof input !== 'object') return 'Request body must be an object.'
  const v = input as Partial<QuoteInput>
  if (!ALLOWED_ASSETS.has(String(v.originAsset)) || !ALLOWED_ASSETS.has(String(v.destinationAsset))) return 'Asset route is not enabled.'
  if (v.originAsset === v.destinationAsset) return 'Origin and destination assets must differ.'
  if (!/^\d+$/.test(String(v.amount)) || BigInt(String(v.amount)) <= 0n) return 'Amount must be a positive integer in the asset’s smallest unit.'
  if (String(v.amount).length > 30) return 'Amount is too large.'
  if (!ADDRESS_PATTERNS.some(pattern => pattern.test(String(v.recipient)))) return 'Recipient address is not valid.'
  if (!ADDRESS_PATTERNS.some(pattern => pattern.test(String(v.refundTo)))) return 'Refund address is not valid.'
  const deadline = v.deadline ? new Date(v.deadline) : new Date(Date.now() + 3 * 60 * 1000)
  if (!Number.isFinite(deadline.getTime()) || deadline.getTime() <= Date.now()) return 'Deadline must be in the future.'
  if (deadline.getTime() > Date.now() + 15 * 60 * 1000) return 'Deadline cannot be more than 15 minutes away.'
  return { originAsset: String(v.originAsset), destinationAsset: String(v.destinationAsset), amount: String(v.amount), recipient: String(v.recipient), refundTo: String(v.refundTo), deadline: deadline.toISOString() }
}

export async function oneClick(path: string, init: RequestInit = {}) {
  const jwt = process.env.ORI_1CLICK_JWT
  if (!jwt) return json({ error: 'Live settlement is not configured.' }, 503)
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  headers.set('x-api-key', jwt)
  const response = await fetch(ONECLICK + path, { ...init, headers, signal: AbortSignal.timeout(15000) })
  const body = await response.json().catch(() => ({ message: 'Invalid response from 1Click.' }))
  if (!response.ok) return json({ error: body.message || `1Click returned ${response.status}.` }, response.status >= 500 ? 502 : response.status)
  return json(body)
}
